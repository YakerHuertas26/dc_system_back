import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { createMaintenanceDataSource } from '../config/maintenance-data-source';
import { ConfigurationError } from '../config/runtime-config';
import { EnsureUserPasswordCapacity1794153600000 } from '../migrations/1794153600000-EnsureUserPasswordCapacity';
import { Role } from '../modules/roles/entities/role.entity';
import { User } from '../modules/users/entities/user.entity';
import {
  runSecurityMigration,
  runSecurityMigrationCli,
} from './migrate-security';

describe('C2 dedicated migration runner without a database', () => {
  const input = {
    DB_HOST: '127.0.0.1',
    DB_USER: 'synthetic_operator',
    DB_PASSWORD: 'Synthetic-maintenance-only!29',
    DB_NAME: 'synthetic_database',
  };
  let source: {
    isInitialized: boolean;
    options: Record<string, unknown>;
    migrations: EnsureUserPasswordCapacity1794153600000[];
    initialize: jest.Mock;
    runMigrations: jest.Mock;
    destroy: jest.Mock;
  };
  let factory: jest.Mock;

  beforeEach(() => {
    source = {
      isInitialized: false,
      options: {
        type: 'mysql',
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
        logging: false,
      },
      migrations: [new EnsureUserPasswordCapacity1794153600000()],
      initialize: jest.fn(() => {
        source.isInitialized = true;
        return Promise.resolve(source);
      }),
      runMigrations: jest.fn(() => Promise.resolve(source.migrations)),
      destroy: jest.fn(() => {
        source.isInitialized = false;
        return Promise.resolve();
      }),
    };
    factory = jest.fn(() => source as unknown as DataSource);
  });

  it('constructs an uninitialized isolated datasource with only reviewed entities and migration', () => {
    const initialize = jest.spyOn(DataSource.prototype, 'initialize');
    try {
      const maintenance = createMaintenanceDataSource(input);
      expect(maintenance.isInitialized).toBe(false);
      expect(initialize).not.toHaveBeenCalled();
      expect(maintenance.options).toMatchObject({
        type: 'mysql',
        port: 3306,
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
        logging: false,
        poolSize: 1,
        migrationsTransactionMode: 'none',
        entities: [User, Role],
        migrations: [EnsureUserPasswordCapacity1794153600000],
      });
    } finally {
      initialize.mockRestore();
    }
  });

  it('requires DB configuration but does not require JWT configuration', () => {
    const maintenance = createMaintenanceDataSource(input);
    expect(maintenance.isInitialized).toBe(false);
    expect(() =>
      createMaintenanceDataSource({ ...input, DB_PASSWORD: undefined }),
    ).toThrow(ConfigurationError);
  });

  it('initializes deliberately, runs only reviewed migrations without a DDL transaction, then closes its datasource', async () => {
    await runSecurityMigration(input, factory);
    expect(factory).toHaveBeenCalledWith(input);
    expect(source.initialize).toHaveBeenCalledTimes(1);
    expect(source.runMigrations).toHaveBeenCalledWith({ transaction: 'none' });
    expect(source.destroy).toHaveBeenCalledTimes(1);
    expect(source.initialize.mock.invocationCallOrder[0]).toBeLessThan(
      source.runMigrations.mock.invocationCallOrder[0],
    );
    expect(source.runMigrations.mock.invocationCallOrder[0]).toBeLessThan(
      source.destroy.mock.invocationCallOrder[0],
    );
  });

  it('accepts an already-applied migration without inventing another operation', async () => {
    source.runMigrations.mockResolvedValue([]);
    await expect(runSecurityMigration(input, factory)).resolves.toBeUndefined();
    expect(source.destroy).toHaveBeenCalledTimes(1);
  });

  it.each(['--password=synthetic-private', '--down', 'unexpected'])(
    'rejects arguments before creating a datasource',
    async (argument) => {
      await expect(
        runSecurityMigration(input, factory, [argument]),
      ).rejects.toMatchObject({ code: 'SECURITY_MIGRATION_ARGUMENTS_INVALID' });
      expect(factory).not.toHaveBeenCalled();
    },
  );

  it('sanitizes a construction failure without retaining the original error', async () => {
    factory.mockImplementation(() => {
      throw new Error('Synthetic-private-constructor');
    });
    await expect(runSecurityMigration(input, factory)).rejects.toMatchObject({
      code: 'SECURITY_MIGRATION_FAILED',
      message: 'SECURITY_MIGRATION_FAILED',
    });
    expect(source.initialize).not.toHaveBeenCalled();
  });

  it('does not run DDL after initialization fails', async () => {
    source.initialize.mockRejectedValue(
      new Error('Synthetic-private-initialize'),
    );
    await expect(runSecurityMigration(input, factory)).rejects.toMatchObject({
      code: 'SECURITY_MIGRATION_FAILED',
    });
    expect(source.runMigrations).not.toHaveBeenCalled();
  });

  it('does not trust initialize resolving while isInitialized remains false', async () => {
    source.initialize.mockResolvedValue(source);
    await expect(runSecurityMigration(input, factory)).rejects.toMatchObject({
      code: 'SECURITY_MIGRATION_FAILED',
    });
    expect(source.runMigrations).not.toHaveBeenCalled();
  });

  it('cleans up a datasource when initialization leaves it marked initialized before failing', async () => {
    source.initialize.mockImplementation(() => {
      source.isInitialized = true;
      return Promise.reject(new Error('Synthetic-private-partial'));
    });
    await expect(runSecurityMigration(input, factory)).rejects.toMatchObject({
      code: 'SECURITY_MIGRATION_FAILED',
    });
    expect(source.destroy).toHaveBeenCalledTimes(1);
  });

  it('sanitizes a migration failure and closes the owned datasource without retrying', async () => {
    source.runMigrations.mockRejectedValue(
      new Error('Synthetic-private-SQL-parameters'),
    );
    await expect(runSecurityMigration(input, factory)).rejects.toMatchObject({
      code: 'SECURITY_MIGRATION_FAILED',
    });
    expect(source.runMigrations).toHaveBeenCalledTimes(1);
    expect(source.destroy).toHaveBeenCalledTimes(1);
  });

  it('reports failed cleanup instead of claiming a complete successful run', async () => {
    source.destroy.mockRejectedValue(new Error('Synthetic-private-cleanup'));
    await expect(runSecurityMigration(input, factory)).rejects.toMatchObject({
      code: 'SECURITY_MIGRATION_CLEANUP_FAILED',
    });
    expect(source.runMigrations).toHaveBeenCalledTimes(1);
  });

  it('rejects cleanup that leaves the owned datasource initialized', async () => {
    source.destroy.mockResolvedValue(undefined);
    await expect(runSecurityMigration(input, factory)).rejects.toMatchObject({
      code: 'SECURITY_MIGRATION_CLEANUP_FAILED',
    });
  });

  it('rejects a datasource that is already owned by another caller', async () => {
    source.isInitialized = true;
    await expect(runSecurityMigration(input, factory)).rejects.toMatchObject({
      code: 'SECURITY_MIGRATION_FAILED',
    });
    expect(source.runMigrations).not.toHaveBeenCalled();
    expect(source.destroy).not.toHaveBeenCalled();
  });

  it('rejects unreviewed registered migrations before any migration runs', async () => {
    source.migrations.push({
      name: 'OtherMigration1794153600001',
    } as unknown as EnsureUserPasswordCapacity1794153600000);
    await expect(runSecurityMigration(input, factory)).rejects.toMatchObject({
      code: 'SECURITY_MIGRATION_FAILED',
    });
    expect(source.runMigrations).not.toHaveBeenCalled();
    expect(source.destroy).toHaveBeenCalledTimes(1);
  });

  it.each(['synchronize', 'migrationsRun', 'dropSchema', 'logging'])(
    'rejects an unsafe datasource option: %s',
    async (key) => {
      source.options[key] = true;
      await expect(runSecurityMigration(input, factory)).rejects.toMatchObject({
        code: 'SECURITY_MIGRATION_FAILED',
      });
      expect(source.initialize).not.toHaveBeenCalled();
      expect(source.runMigrations).not.toHaveBeenCalled();
    },
  );

  it('prints only the success code after completed cleanup', async () => {
    const output = { out: jest.fn(), err: jest.fn() };
    const status = await runSecurityMigrationCli(input, [], factory, output);
    expect(status).toBe(0);
    expect(output.out).toHaveBeenCalledWith('SECURITY_MIGRATION_COMPLETE');
    expect(output.err).not.toHaveBeenCalled();
  });

  it('does not inspect an original error message, stack, or cause', async () => {
    const privateError = new Error();
    for (const key of ['message', 'stack', 'cause']) {
      Object.defineProperty(privateError, key, {
        get: () => {
          throw new Error('Private getter accessed');
        },
      });
    }
    factory.mockImplementation(() => {
      throw privateError;
    });
    const output = { out: jest.fn(), err: jest.fn() };
    expect(await runSecurityMigrationCli(input, [], factory, output)).toBe(1);
    expect(output.out).not.toHaveBeenCalled();
    expect(output.err).toHaveBeenCalledWith('SECURITY_MIGRATION_FAILED');
  });

  it('does not echo rejected arguments or credentials to either output', async () => {
    const output = { out: jest.fn(), err: jest.fn() };
    expect(
      await runSecurityMigrationCli(
        input,
        ['--password=synthetic-private'],
        factory,
        output,
      ),
    ).toBe(1);
    expect(output.out).not.toHaveBeenCalled();
    expect(output.err).toHaveBeenCalledWith(
      'SECURITY_MIGRATION_ARGUMENTS_INVALID',
    );
    expect(factory).not.toHaveBeenCalled();
  });
});
