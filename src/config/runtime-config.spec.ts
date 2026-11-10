import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { DataSource, DataSourceOptions } from 'typeorm';
import { createDataSourceSafely, typeOrmConfig } from './typeorm.config';
import {
  ConfigurationError,
  validateDatabaseConfig,
  validateJwtConfig,
  validateJwtSecret,
  validateRuntimeConfig,
} from './runtime-config';

function databaseInput(): Record<string, unknown> {
  return {
    DB_HOST: 'db.example.invalid',
    DB_PORT: '3307',
    DB_USER: 'synthetic-user',
    DB_PASSWORD: ' SYNTHETIC-db-password ',
    DB_NAME: 'synthetic_database',
  };
}

function runtimeInput(): Record<string, unknown> {
  return {
    ...databaseInput(),
    JWT_SECRET: randomBytes(32).toString('hex'),
    JWT_EXPIRATION: '1h',
  };
}

// This double cannot fall through to ConfigService's process.env lookup.
function configService(input: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => input[key],
    getOrThrow: (key: string) => {
      if (input[key] === undefined) throw new Error(`Missing ${key}`);
      return input[key];
    },
  } as unknown as ConfigService;
}

function expectConfigurationError(action: () => unknown, variable: string) {
  let failure: unknown;
  try {
    action();
  } catch (error) {
    failure = error;
  }
  expect(failure instanceof ConfigurationError).toBe(true);
  expect((failure as Error).name).toBe('ConfigurationError');
  expect((failure as Error).message.includes(variable)).toBe(true);
}

describe('C1 existing TypeORM factory', () => {
  it.each(['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'])(
    'rejects missing %s instead of silently choosing defaults',
    (variable) => {
      const input = databaseInput();
      delete input[variable];
      expect(() => typeOrmConfig(configService(input))).toThrow();
    },
  );

  it('rejects an invalid location containing a connection URI', () => {
    const input = {
      ...databaseInput(),
      DB_HOST: 'mysql://synthetic-user:synthetic-password@db.example.invalid/x',
    };
    expect(() => typeOrmConfig(configService(input))).toThrow();
  });

  it('rejects an explicit invalid port instead of replacing it with a default', () => {
    expect(() =>
      typeOrmConfig(configService({ ...databaseInput(), DB_PORT: 0 })),
    ).toThrow();
  });

  it('disables sensitive query logging and preserves safe ORM switches', () => {
    const options = typeOrmConfig(configService(databaseInput()));
    expect(options.logging).toBe(false);
    expect(options.synchronize).toBe(false);
    expect(options.autoLoadEntities).toBe(true);
    expect(options.type).toBe('mysql');
  });
});

describe('C1 pure database configuration', () => {
  it('preserves explicit connection data and password bytes while normalizing the port', () => {
    const input = databaseInput();
    const result = validateDatabaseConfig(input);
    expect(result.host).toBe('db.example.invalid');
    expect(result.port).toBe(3307);
    expect(result.username).toBe('synthetic-user');
    expect(result.database).toBe('synthetic_database');
    expect(result.password === input.DB_PASSWORD).toBe(true);
    expect(input.DB_PORT).toBe('3307');
  });

  it('uses the non-secret 3306 default only when DB_PORT is absent', () => {
    const input = databaseInput();
    delete input.DB_PORT;
    expect(validateDatabaseConfig(input).port).toBe(3306);
  });

  it.each([
    ['DB_HOST', 42],
    ['DB_USER', null],
    ['DB_NAME', undefined],
    ['DB_PASSWORD', ''],
    ['DB_PASSWORD', '   '],
    ['DB_PASSWORD', false],
  ] as const)('rejects invalid %s input case %#', (variable, value) => {
    expectConfigurationError(
      () =>
        validateDatabaseConfig({
          ...databaseInput(),
          [variable]: value,
        }),
      variable,
    );
  });

  it.each([
    'mysql://db.example.invalid/database',
    'db.example.invalid\nSYNTHETIC-CONTROL',
    'db.example.invalid\u0000SYNTHETIC-CONTROL',
  ])('rejects an unsafe host case %#', (host) => {
    expectConfigurationError(
      () =>
        validateDatabaseConfig({
          ...databaseInput(),
          DB_HOST: host,
        }),
      'DB_HOST',
    );
  });

  it.each([
    [3308, 3308],
    ['3309', 3309],
  ] as const)('accepts an explicit integer port case %#', (value, expected) => {
    expect(
      validateDatabaseConfig({
        ...databaseInput(),
        DB_PORT: value,
      }).port,
    ).toBe(expected);
  });

  it.each(['', null, 0, '3306x', '3.14', '3306\n', 65536, -1, Number.NaN])(
    'rejects an invalid port without parseInt coercion case %#',
    (value) => {
      expectConfigurationError(
        () =>
          validateDatabaseConfig({
            ...databaseInput(),
            DB_PORT: value,
          }),
        'DB_PORT',
      );
    },
  );
});

describe('C1 JWT secret and duration contract', () => {
  it('returns the supplied random secret without changing its bytes', () => {
    const secret = randomBytes(32).toString('hex');
    expect(validateJwtSecret(secret) === secret).toBe(true);
  });

  it('measures secret sufficiency in UTF-8 bytes rather than characters', () => {
    const secret = `${randomBytes(18).toString('base64')}\u00f1\u6c34\u{1f600}\u03a3`;
    expect(secret.length < 32).toBe(true);
    expect(Buffer.byteLength(secret, 'utf8') >= 32).toBe(true);
    expect(validateJwtSecret(secret) === secret).toBe(true);
  });

  it.each([
    undefined,
    null,
    '   ',
    'short-synthetic-value',
    'a'.repeat(64),
    'changeme'.repeat(8),
    `${randomBytes(16).toString('hex')}\u0000${randomBytes(16).toString('hex')}`,
    ` ${randomBytes(32).toString('hex')}`,
    `${randomBytes(32).toString('hex')}\n`,
  ])('rejects missing, weak or altered-border secrets case %#', (value) => {
    expectConfigurationError(() => validateJwtSecret(value), 'JWT_SECRET');
  });

  it.each([
    ['1s', 1],
    ['1m', 60],
    ['24h', 86400],
    ['1d', 86400],
  ] as const)('converts explicit duration units case %#', (value, expected) => {
    const input: Record<string, unknown> = {
      ...runtimeInput(),
      JWT_EXPIRATION: value,
    };
    const options = validateJwtConfig(input);
    expect(options.expiresIn).toBe(expected);
    expect(options.secret === input.JWT_SECRET).toBe(true);
  });

  it.each([
    undefined,
    86400,
    '86400',
    '0s',
    '0.5h',
    '25h',
    '-1h',
    '1h\n',
    '1h ',
    '9999999999999999999999999d',
  ])('rejects missing, ambiguous or out-of-range duration case %#', (value) => {
    expectConfigurationError(
      () =>
        validateJwtConfig({
          ...runtimeInput(),
          JWT_EXPIRATION: value,
        }),
      'JWT_EXPIRATION',
    );
  });

  it('produces real signed tokens with the expected claims, key and exact expiry', () => {
    const input = runtimeInput();
    const options = validateJwtConfig(input);
    const jwt = new JwtService({
      secret: options.secret,
      signOptions: { expiresIn: options.expiresIn },
    });
    const token = jwt.sign({
      sub: 17,
      name: 'synthetic-user',
      roleName: 'Admin',
      roleId: 7,
    });
    const payload = jwt.verify<{
      sub: number;
      name: string;
      roleName: string;
      roleId: number;
      iat: number;
      exp: number;
    }>(token, { secret: input.JWT_SECRET as string });
    expect(payload.sub).toBe(17);
    expect(payload.name).toBe('synthetic-user');
    expect(payload.roleName).toBe('Admin');
    expect(payload.roleId).toBe(7);
    expect(payload.exp - payload.iat).toBe(3600);
    expect(() => {
      jwt.verify<Record<string, unknown>>(token, {
        secret: randomBytes(32).toString('hex'),
      });
    }).toThrow();
    expect(() => {
      jwt.verify<Record<string, unknown>>(token, {
        clockTimestamp: payload.exp + 1,
      });
    }).toThrow();
  });
});

describe('C1 whole-runtime validation and preflight ordering', () => {
  it('preserves the caller input and original duration while returning normalized ports', () => {
    const input: Record<string, unknown> = {
      ...runtimeInput(),
      EXTRA_SYNTHETIC_FLAG: 'keep-me',
    };
    const result = validateRuntimeConfig(input);
    expect(result).not.toBe(input);
    expect(result.DB_PORT).toBe(3307);
    expect(result.JWT_EXPIRATION).toBe('1h');
    expect(result.JWT_SECRET === input.JWT_SECRET).toBe(true);
    expect(result.DB_PASSWORD === input.DB_PASSWORD).toBe(true);
    expect(result.EXTRA_SYNTHETIC_FLAG).toBe('keep-me');
    expect(input.DB_PORT).toBe('3307');
    expect(input.JWT_EXPIRATION).toBe('1h');
  });

  it('fails real ConfigModule validation before any fake database provider is called', async () => {
    const input = { ...runtimeInput(), JWT_EXPIRATION: '25h' };
    const databaseFactory = jest.fn<undefined, []>(() => undefined);
    const prepare = async () => {
      await ConfigModule.forRoot({
        ignoreEnvFile: true,
        ignoreEnvVars: true,
        validatePredefined: false,
        skipProcessEnv: true,
        validate: () => validateRuntimeConfig(input),
      });
      return databaseFactory();
    };
    await expect(prepare()).rejects.toBeInstanceOf(ConfigurationError);
    expect(databaseFactory).not.toHaveBeenCalled();
  });

  it('reports only the invalid variable without echoing values or the environment', () => {
    const input: Record<string, unknown> = {
      ...runtimeInput(),
      DB_HOST:
        'mysql://synthetic-private:synthetic-password@db.example.invalid/x',
    };
    let failure: unknown;
    try {
      validateRuntimeConfig(input);
    } catch (error) {
      failure = error;
    }
    expect(failure instanceof ConfigurationError).toBe(true);
    const error = failure as Error;
    expect(error.message.includes('DB_HOST')).toBe(true);
    const output = `${String(error)} ${JSON.stringify(error)}`;
    for (const value of [
      input.DB_HOST,
      input.DB_PASSWORD,
      input.JWT_SECRET,
      'synthetic-private',
      'synthetic-password',
    ]) {
      expect(output.includes(value as string)).toBe(false);
    }
  });
});

function dataSourceFixture() {
  const source = {
    isInitialized: false,
    initialize: jest.fn<Promise<DataSource>, []>(),
    destroy: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  };
  source.initialize.mockImplementation(() => {
    source.isInitialized = true;
    return Promise.resolve(source as unknown as DataSource);
  });
  const options: DataSourceOptions = {
    type: 'mysql',
    host: 'db.example.invalid',
    port: 3307,
    username: 'synthetic-user',
    password: 'SYNTHETIC-private-password',
    database: 'synthetic_database',
    synchronize: false,
    logging: false,
  };
  return { source, options };
}

async function expectSanitizedDataSourceError(action: Promise<DataSource>) {
  let failure: unknown;
  try {
    await action;
  } catch (error) {
    failure = error;
  }
  expect(failure instanceof Error).toBe(true);
  const error = failure as Error;
  expect(error.message).toBe('No se pudo inicializar la base de datos.');
  expect('cause' in error).toBe(false);
  const output = `${String(error)} ${error.stack ?? ''} ${JSON.stringify(error)}`;
  for (const privateValue of [
    'SYNTHETIC-driver-secret',
    'SYNTHETIC-cleanup-secret',
    'SYNTHETIC-constructor-secret',
    'SYNTHETIC-private-password',
  ]) {
    expect(output.includes(privateValue)).toBe(false);
  }
}

describe('C1 datasource error boundary with no actual datasource', () => {
  it('rejects missing options before constructing or initializing any datasource', async () => {
    const { source } = dataSourceFixture();
    const factory = jest.fn(() => source as unknown as DataSource);
    await expectSanitizedDataSourceError(
      createDataSourceSafely(undefined, factory),
    );
    expect(factory).not.toHaveBeenCalled();
    expect(source.initialize).not.toHaveBeenCalled();
  });

  it('initializes and returns the fake datasource exactly once', async () => {
    const { source, options } = dataSourceFixture();
    const factory = jest.fn(() => source as unknown as DataSource);
    const result = await createDataSourceSafely(options, factory);
    expect(result === (source as unknown as DataSource)).toBe(true);
    expect(source.isInitialized).toBe(true);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(source.initialize).toHaveBeenCalledTimes(1);
    expect(source.destroy).not.toHaveBeenCalled();
  });

  it('does not initialize a datasource that was already initialized', async () => {
    const { source, options } = dataSourceFixture();
    source.isInitialized = true;
    const result = await createDataSourceSafely(
      options,
      () => source as unknown as DataSource,
    );
    expect(result === (source as unknown as DataSource)).toBe(true);
    expect(source.initialize).not.toHaveBeenCalled();
  });

  it('sanitizes initialization errors before Nest retry logging can inspect their stack', async () => {
    const { source, options } = dataSourceFixture();
    const failure = new Error('SYNTHETIC-driver-secret');
    failure.stack = 'SYNTHETIC-driver-secret SYNTHETIC-private-password';
    source.initialize.mockRejectedValue(failure);
    await expectSanitizedDataSourceError(
      createDataSourceSafely(options, () => source as unknown as DataSource),
    );
  });

  it('sanitizes constructor errors without leaking the supplied connection options', async () => {
    const { options } = dataSourceFixture();
    await expectSanitizedDataSourceError(
      createDataSourceSafely(options, () => {
        throw new Error('SYNTHETIC-constructor-secret');
      }),
    );
  });

  it('sanitizes cleanup failures as well as the initialization failure', async () => {
    const { source, options } = dataSourceFixture();
    source.initialize.mockImplementation(() => {
      source.isInitialized = true;
      return Promise.reject(new Error('SYNTHETIC-driver-secret'));
    });
    source.destroy.mockRejectedValue(new Error('SYNTHETIC-cleanup-secret'));
    await expectSanitizedDataSourceError(
      createDataSourceSafely(options, () => source as unknown as DataSource),
    );
    expect(source.destroy).toHaveBeenCalledTimes(1);
  });

  it('rejects an uninitialized result so Nest cannot initialize outside the sanitizing boundary', async () => {
    const { source, options } = dataSourceFixture();
    source.initialize.mockResolvedValue(source as unknown as DataSource);
    await expectSanitizedDataSourceError(
      createDataSourceSafely(options, () => source as unknown as DataSource),
    );
    expect(source.isInitialized).toBe(false);
  });
});
