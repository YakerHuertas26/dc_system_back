import 'reflect-metadata';
import bcrypt from 'bcrypt';
import type { DataSource, QueryRunner } from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { User } from '../entities/user.entity';
import {
  AdminBootstrapError,
  AdminBootstrapInput,
  bootstrapFirstAdmin,
} from '../admin-bootstrap.service';

const identity: AdminBootstrapInput = {
  name: 'synthetic-first-admin',
  email: 'first@example.invalid',
  password: 'Synthetic1!Bootstrap',
};
const configuration: Record<string, unknown> = {
  DB_HOST: 'db.example.invalid',
  DB_PORT: '3306',
  DB_USER: 'synthetic-operator',
  DB_PASSWORD: 'SYNTHETIC-db-private-password',
  DB_NAME: 'synthetic_database',
};
const rawDriverError = 'SYNTHETIC-driver-private-detail';

interface Rows {
  roles: Role[];
  users: User[];
}
interface NamedLock {
  owner?: object;
}
interface Scenario {
  rows?: Rows;
  namedLock?: NamedLock;
  lockResult?: unknown;
  tables?: unknown;
  columns?: unknown;
  initiallyInitialized?: boolean;
  initializedFlagMissing?: boolean;
  failInitialize?: boolean;
  failConnect?: boolean;
  failGetLock?: boolean;
  failRoleSave?: boolean;
  failUserSave?: boolean;
  readBack?: 'missing' | 'truncated' | 'different-user';
  failCommit?: 'before' | 'after' | 'active';
  failRollback?: boolean;
  failReleaseLock?: boolean;
  failReleaseRunner?: boolean;
  failDestroy?: boolean;
  lockAcquired?: () => void;
  pauseAfterLock?: Promise<void>;
}

function role(roleId: number, name: string): Role {
  return Object.assign(new Role(), { roleId, name });
}

// Every query and repository operation below is an in-memory double. Named
// locks/transactions model the protocol only; they do not certify MySQL.
function fixture(scenario: Scenario = {}) {
  const rows = scenario.rows ?? {
    roles: [role(1, 'Admin'), role(2, 'Vendedor')],
    users: [],
  };
  const namedLock = scenario.namedLock ?? {};
  const owner = {};
  const events: string[] = [];
  let snapshot: Rows | undefined;
  const copyRole = (entry: Role) => Object.assign(new Role(), entry);
  const copyUser = (entry: User) => Object.assign(new User(), entry);
  const restore = () => {
    if (!snapshot) return;
    rows.roles.splice(0, rows.roles.length, ...snapshot.roles.map(copyRole));
    rows.users.splice(0, rows.users.length, ...snapshot.users.map(copyUser));
  };
  const roleBuilder = {
    setLock: jest.fn(),
    getMany: jest.fn(() => Promise.resolve(rows.roles.map(copyRole))),
  };
  roleBuilder.setLock.mockReturnValue(roleBuilder);
  const roles = {
    createQueryBuilder: jest.fn(() => roleBuilder),
    create: jest.fn((input: Partial<Role>) => Object.assign(new Role(), input)),
    save: jest.fn((input: Role) => {
      events.push('role:save');
      if (scenario.failRoleSave)
        return Promise.reject(new Error(rawDriverError));
      const saved = Object.assign(new Role(), input, {
        roleId:
          input.roleId ?? 1 + Math.max(0, ...rows.roles.map((r) => r.roleId)),
      });
      rows.roles.push(copyRole(saved));
      return Promise.resolve(saved);
    }),
  };
  const users = {
    exists: jest.fn(
      ({
        where,
      }: {
        where: Record<string, unknown> | Record<string, unknown>[];
      }) => {
        const alternatives = Array.isArray(where) ? where : [where];
        return Promise.resolve(
          rows.users.some((user) =>
            alternatives.some((clause) =>
              Object.entries(clause).every(
                ([key, value]) =>
                  (user as unknown as Record<string, unknown>)[key] === value,
              ),
            ),
          ),
        );
      },
    ),
    create: jest.fn((input: Partial<User>) => Object.assign(new User(), input)),
    save: jest.fn((input: User) => {
      events.push('user:save');
      if (scenario.failUserSave)
        return Promise.reject(new Error(rawDriverError));
      const saved = Object.assign(new User(), input, { userId: 17 });
      rows.users.push(copyUser(saved));
      return Promise.resolve(saved);
    }),
    findOne: jest.fn(({ where }: { where: { userId: number } }) => {
      events.push('user:readback');
      const stored = rows.users.find((entry) => entry.userId === where.userId);
      if (!stored || scenario.readBack === 'missing')
        return Promise.resolve(null);
      const result = copyUser(stored);
      if (scenario.readBack === 'truncated')
        result.password = result.password.slice(0, 45);
      if (scenario.readBack === 'different-user') result.userId = 999;
      return Promise.resolve(result);
    }),
  };
  const source = {
    options: {
      type: 'mysql',
      synchronize: false,
      migrationsRun: false,
      dropSchema: false,
      logging: false,
      poolSize: 1,
    },
    isInitialized: scenario.initiallyInitialized ?? false,
    initialize: jest.fn<Promise<DataSource>, []>(),
    createQueryRunner: jest.fn(),
    destroy: jest.fn<Promise<void>, []>(),
  };
  const runner = {
    connection: source as unknown as DataSource,
    isReleased: false,
    isTransactionActive: false,
    manager: {
      getRepository: jest.fn((entity: unknown) => {
        if (!runner.isTransactionActive)
          throw new Error('Manager used outside transaction');
        if (entity === Role) return roles;
        if (entity === User) return users;
        throw new Error('Unexpected entity');
      }),
    },
    connect: jest.fn(() => {
      events.push('runner:connect');
      return scenario.failConnect
        ? Promise.reject(new Error(rawDriverError))
        : Promise.resolve();
    }),
    query: jest.fn<Promise<unknown>, [string, unknown[]?]>(),
    startTransaction: jest.fn(() => {
      events.push('transaction:start');
      snapshot = {
        roles: rows.roles.map(copyRole),
        users: rows.users.map(copyUser),
      };
      runner.isTransactionActive = true;
      return Promise.resolve();
    }),
    commitTransaction: jest.fn(() => {
      events.push('transaction:commit');
      if (scenario.failCommit === 'before')
        return Promise.reject(new Error(rawDriverError));
      if (scenario.failCommit === 'active') return Promise.resolve();
      runner.isTransactionActive = false;
      if (scenario.failCommit === 'after')
        return Promise.reject(new Error(rawDriverError));
      return Promise.resolve();
    }),
    rollbackTransaction: jest.fn(() => {
      events.push('transaction:rollback');
      if (scenario.failRollback)
        return Promise.reject(new Error(rawDriverError));
      restore();
      runner.isTransactionActive = false;
      return Promise.resolve();
    }),
    release: jest.fn(() => {
      events.push('runner:release');
      if (scenario.failReleaseRunner)
        return Promise.reject(new Error(rawDriverError));
      runner.isReleased = true;
      return Promise.resolve();
    }),
  };
  runner.query.mockImplementation(async (sql) => {
    if (sql.includes('GET_LOCK')) {
      events.push('lock:acquire');
      if (scenario.failGetLock) throw new Error(rawDriverError);
      const value = Object.prototype.hasOwnProperty.call(scenario, 'lockResult')
        ? scenario.lockResult
        : namedLock.owner
          ? 0
          : 1;
      if (value === 1) {
        namedLock.owner = owner;
        scenario.lockAcquired?.();
        if (scenario.pauseAfterLock) await scenario.pauseAfterLock;
      }
      return [{ acquired: value }];
    }
    if (sql.includes('RELEASE_LOCK')) {
      events.push('lock:release');
      if (scenario.failReleaseLock) throw new Error(rawDriverError);
      if (namedLock.owner !== owner) return [{ released: 0 }];
      namedLock.owner = undefined;
      return [{ released: 1 }];
    }
    if (sql.includes('information_schema.TABLES')) {
      return (
        scenario.tables ?? [
          { tableName: 'users', engine: 'InnoDB' },
          { tableName: 'roles', engine: 'InnoDB' },
        ]
      );
    }
    if (sql.includes('information_schema.COLUMNS')) {
      return (
        scenario.columns ?? [
          { dataType: 'varchar', capacity: 255, nullable: 'NO' },
        ]
      );
    }
    throw new Error('Unexpected fake query');
  });
  source.initialize.mockImplementation(() => {
    events.push('source:initialize');
    if (scenario.failInitialize)
      return Promise.reject(new Error(rawDriverError));
    source.isInitialized = !scenario.initializedFlagMissing;
    return Promise.resolve(source as unknown as DataSource);
  });
  source.createQueryRunner.mockImplementation(
    () => runner as unknown as QueryRunner,
  );
  source.destroy.mockImplementation(() => {
    events.push('source:destroy');
    if (scenario.failDestroy) return Promise.reject(new Error(rawDriverError));
    if (runner.isTransactionActive) restore();
    runner.isTransactionActive = false;
    source.isInitialized = false;
    if (namedLock.owner === owner) namedLock.owner = undefined;
    return Promise.resolve();
  });
  const factory = jest.fn(() => source as unknown as DataSource);
  return {
    rows,
    namedLock,
    events,
    roles,
    roleBuilder,
    users,
    source,
    runner,
    factory,
  };
}

async function failureOf(
  action: Promise<unknown>,
): Promise<AdminBootstrapError> {
  let failure: unknown;
  try {
    await action;
  } catch (error) {
    failure = error;
  }
  expect(failure instanceof AdminBootstrapError).toBe(true);
  const result = failure as AdminBootstrapError;
  const output = `${String(result)} ${result.stack ?? ''} ${JSON.stringify(result)}`;
  for (const value of [
    identity.name,
    identity.email,
    identity.password,
    configuration.DB_PASSWORD,
    rawDriverError,
  ]) {
    expect(output.includes(value as string)).toBe(false);
  }
  expect('cause' in result).toBe(false);
  return result;
}

describe('C3 bootstrap transaction protocol with in-memory datasource doubles', () => {
  it('creates one Admin with an existing canonical role, hashes once and returns only its identifier', async () => {
    const f = fixture();
    const hash = jest.spyOn(bcrypt, 'hash');
    try {
      const result = await bootstrapFirstAdmin(
        identity,
        configuration,
        f.factory,
      );
      expect(result).toEqual({ userId: 17 });
      expect(hash.mock.calls.length).toBe(1);
      expect(f.rows.users.length).toBe(1);
      const stored = f.rows.users[0];
      expect(stored.roleId).toBe(1);
      expect(stored.state).toBe(true);
      expect(stored.password.length).toBe(60);
      expect(await bcrypt.compare(identity.password, stored.password)).toBe(
        true,
      );
      expect(f.roles.save).not.toHaveBeenCalled();
      expect(f.roleBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(f.source.createQueryRunner).toHaveBeenCalledWith('master');
      expect(f.users.save.mock.calls.length).toBe(1);
      expect(
        f.events.indexOf('transaction:start') < f.events.indexOf('user:save'),
      ).toBe(true);
      expect(
        f.events.indexOf('user:readback') <
          f.events.indexOf('transaction:commit'),
      ).toBe(true);
      expect(
        f.events.indexOf('transaction:commit') <
          f.events.indexOf('lock:release'),
      ).toBe(true);
      expect(
        f.events.indexOf('lock:release') < f.events.indexOf('runner:release'),
      ).toBe(true);
      expect(
        f.events.indexOf('runner:release') < f.events.indexOf('source:destroy'),
      ).toBe(true);
      expect(f.namedLock.owner).toBeUndefined();
      expect(f.source.isInitialized).toBe(false);
      expect(f.runner.isReleased).toBe(true);
    } finally {
      hash.mockRestore();
    }
  });

  it('creates the canonical role in the same transaction when no Admin role exists', async () => {
    const f = fixture({ rows: { roles: [role(2, 'Vendedor')], users: [] } });
    await bootstrapFirstAdmin(identity, configuration, f.factory);
    expect(f.rows.roles.filter((entry) => entry.name === 'Admin').length).toBe(
      1,
    );
    expect(f.rows.users[0].roleId).toBe(3);
    expect(f.roles.save.mock.calls.length).toBe(1);
  });

  it.each([true, false])(
    'rejects any existing Admin including inactive accounts case %#',
    async (state) => {
      const f = fixture();
      f.rows.users.push(
        Object.assign(new User(), { userId: 8, roleId: 1, state }),
      );
      const error = await failureOf(
        bootstrapFirstAdmin(identity, configuration, f.factory),
      );
      expect(error.code).toBe('BOOTSTRAP_ALREADY_INITIALIZED');
      expect(f.users.save).not.toHaveBeenCalled();
      expect(f.rows.users[0].state).toBe(state);
    },
  );

  it('rejects a second invocation instead of creating or promoting another account', async () => {
    const sharedRows: Rows = { roles: [role(1, 'Admin')], users: [] };
    const first = fixture({ rows: sharedRows });
    await bootstrapFirstAdmin(identity, configuration, first.factory);
    const second = fixture({ rows: sharedRows });
    const error = await failureOf(
      bootstrapFirstAdmin(identity, configuration, second.factory),
    );
    expect(error.code).toBe('BOOTSTRAP_ALREADY_INITIALIZED');
    expect(sharedRows.users.length).toBe(1);
    expect(second.users.save).not.toHaveBeenCalled();
  });

  it.each(['admin', 'ADMIN', ' Admin', 'Admin '])(
    'rejects a noncanonical reserved role case %#',
    async (name) => {
      const f = fixture({ rows: { roles: [role(1, name)], users: [] } });
      const error = await failureOf(
        bootstrapFirstAdmin(identity, configuration, f.factory),
      );
      expect(error.code).toBe('BOOTSTRAP_ROLES_INCONSISTENT');
      expect(f.roles.save).not.toHaveBeenCalled();
      expect(f.users.save).not.toHaveBeenCalled();
    },
  );

  it('rejects duplicate canonical roles rather than selecting one arbitrarily', async () => {
    const f = fixture({
      rows: { roles: [role(1, 'Admin'), role(2, 'Admin')], users: [] },
    });
    expect(
      (await failureOf(bootstrapFirstAdmin(identity, configuration, f.factory)))
        .code,
    ).toBe('BOOTSTRAP_ROLES_INCONSISTENT');
    expect(f.users.save).not.toHaveBeenCalled();
  });

  it.each(['name', 'email'] as const)(
    'rejects an existing identity by %s without promoting it',
    async (key) => {
      const f = fixture();
      f.rows.users.push(
        Object.assign(new User(), {
          userId: 8,
          roleId: 2,
          state: false,
          name: 'other-synthetic-name',
          email: 'other@example.invalid',
          [key]: identity[key],
        }),
      );
      const error = await failureOf(
        bootstrapFirstAdmin(identity, configuration, f.factory),
      );
      expect(error.code).toBe('BOOTSTRAP_IDENTITY_EXISTS');
      expect(f.rows.users[0].roleId).toBe(2);
      expect(f.rows.users[0].state).toBe(false);
      expect(f.users.save).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: '' },
    { name: 'x'.repeat(26) },
    { email: 'invalid' },
    { password: ` ${identity.password}` },
    { password: `${identity.password} ` },
    { password: `Ab1!${'x'.repeat(69)}` },
  ])(
    'rejects invalid operator input before constructing a datasource case %#',
    async (patch) => {
      const f = fixture();
      const error = await failureOf(
        bootstrapFirstAdmin(
          { ...identity, ...patch },
          configuration,
          f.factory,
        ),
      );
      expect(error.code).toBe('BOOTSTRAP_INPUT_INVALID');
      expect(f.factory).not.toHaveBeenCalled();
    },
  );

  it('rejects missing database configuration without a fallback or datasource', async () => {
    const f = fixture();
    const input = { ...configuration };
    delete input.DB_PASSWORD;
    expect(
      (await failureOf(bootstrapFirstAdmin(identity, input, f.factory))).code,
    ).toBe('BOOTSTRAP_CONFIGURATION_INVALID');
    expect(f.factory).not.toHaveBeenCalled();
  });

  it('reports crypto failure as an operational failure without creating a datasource', async () => {
    const f = fixture();
    const crypto: {
      hash(
        data: string | Buffer,
        saltOrRounds: number | string,
      ): Promise<string>;
    } = bcrypt;
    const hash = jest
      .spyOn(crypto, 'hash')
      .mockRejectedValue(new Error(rawDriverError));
    try {
      const error = await failureOf(
        bootstrapFirstAdmin(identity, configuration, f.factory),
      );
      expect(error.code).toBe('BOOTSTRAP_FAILED');
      expect(f.factory).not.toHaveBeenCalled();
    } finally {
      hash.mockRestore();
    }
  });

  it.each([null, '1', undefined])(
    'requires numeric lock acquisition success case %#',
    async (value) => {
      const f = fixture({ lockResult: value });
      const error = await failureOf(
        bootstrapFirstAdmin(identity, configuration, f.factory),
      );
      expect(error.code).toBe('BOOTSTRAP_LOCK_FAILED');
      expect(f.runner.startTransaction).not.toHaveBeenCalled();
      expect(f.users.save).not.toHaveBeenCalled();
    },
  );

  it('rejects an occupied named lock before entering a transaction', async () => {
    const f = fixture({ lockResult: 0 });
    expect(
      (await failureOf(bootstrapFirstAdmin(identity, configuration, f.factory)))
        .code,
    ).toBe('BOOTSTRAP_IN_PROGRESS');
    expect(f.runner.startTransaction).not.toHaveBeenCalled();
  });

  it('sanitizes a lock query error and closes its private source', async () => {
    const f = fixture({ failGetLock: true });
    expect(
      (await failureOf(bootstrapFirstAdmin(identity, configuration, f.factory)))
        .code,
    ).toBe('BOOTSTRAP_FAILED');
    expect(f.source.destroy.mock.calls.length).toBe(1);
    expect(f.users.save).not.toHaveBeenCalled();
  });

  it.each([
    {
      tables: [
        { tableName: 'users', engine: 'MyISAM' },
        { tableName: 'roles', engine: 'InnoDB' },
      ],
    },
    { columns: [{ dataType: 'varchar', capacity: 45, nullable: 'NO' }] },
    { columns: [{ dataType: 'varchar', capacity: 255, nullable: 'YES' }] },
    { columns: [{ dataType: 'text', capacity: 65535, nullable: 'NO' }] },
  ])(
    'rejects unsupported metadata before any account write case %#',
    async (scenario) => {
      const f = fixture(scenario);
      expect(
        (
          await failureOf(
            bootstrapFirstAdmin(identity, configuration, f.factory),
          )
        ).code,
      ).toBe('BOOTSTRAP_SCHEMA_UNSUPPORTED');
      expect(f.users.save).not.toHaveBeenCalled();
      expect(f.roles.save).not.toHaveBeenCalled();
      expect(f.runner.rollbackTransaction.mock.calls.length).toBe(1);
    },
  );

  it.each(['missing', 'truncated', 'different-user'] as const)(
    'requires trustworthy persisted hash readback before commit case %#',
    async (readBack) => {
      const f = fixture({ readBack });
      expect(
        (
          await failureOf(
            bootstrapFirstAdmin(identity, configuration, f.factory),
          )
        ).code,
      ).toBe('BOOTSTRAP_FAILED');
      expect(f.runner.commitTransaction).not.toHaveBeenCalled();
      expect(f.rows.users.length).toBe(0);
    },
  );

  it('rolls back a newly created role when the user save fails', async () => {
    const f = fixture({ rows: { roles: [], users: [] }, failUserSave: true });
    await failureOf(bootstrapFirstAdmin(identity, configuration, f.factory));
    expect(f.rows.roles.length).toBe(0);
    expect(f.rows.users.length).toBe(0);
    expect(f.runner.rollbackTransaction.mock.calls.length).toBe(1);
  });

  it.each(['before', 'after', 'active'] as const)(
    'marks a failed or unconfirmed commit as indeterminate without retry case %#',
    async (failCommit) => {
      const f = fixture({ failCommit });
      expect(
        (
          await failureOf(
            bootstrapFirstAdmin(identity, configuration, f.factory),
          )
        ).code,
      ).toBe('BOOTSTRAP_COMMIT_UNCERTAIN');
      expect(f.factory.mock.calls.length).toBe(1);
      expect(f.users.save.mock.calls.length).toBe(1);
      if (failCommit === 'after') expect(f.rows.users.length).toBe(1);
    },
  );

  it('does not release an uncertain transactional connection back to a pool after rollback failure', async () => {
    const f = fixture({ failUserSave: true, failRollback: true });
    expect(
      (await failureOf(bootstrapFirstAdmin(identity, configuration, f.factory)))
        .code,
    ).toBe('BOOTSTRAP_CLEANUP_UNCERTAIN');
    expect(f.events.includes('lock:release')).toBe(false);
    expect(f.runner.release).not.toHaveBeenCalled();
    expect(f.source.destroy.mock.calls.length).toBe(1);
    expect(f.namedLock.owner).toBeUndefined();
  });

  it.each([
    { failReleaseLock: true },
    { failReleaseRunner: true },
    { failDestroy: true },
  ])(
    'reports cleanup uncertainty without undoing an already committed Admin case %#',
    async (scenario) => {
      const f = fixture(scenario);
      expect(
        (
          await failureOf(
            bootstrapFirstAdmin(identity, configuration, f.factory),
          )
        ).code,
      ).toBe('BOOTSTRAP_CLEANUP_UNCERTAIN');
      expect(f.rows.users.length).toBe(1);
      expect(f.runner.rollbackTransaction).not.toHaveBeenCalled();
      expect(f.source.destroy.mock.calls.length).toBe(1);
    },
  );

  it('refuses a running shared datasource without destroying it', async () => {
    const f = fixture({ initiallyInitialized: true });
    await failureOf(bootstrapFirstAdmin(identity, configuration, f.factory));
    expect(f.source.initialize).not.toHaveBeenCalled();
    expect(f.source.destroy).not.toHaveBeenCalled();
  });

  it('rejects a datasource whose initialize call does not set the initialized flag', async () => {
    const f = fixture({ initializedFlagMissing: true });
    await failureOf(bootstrapFirstAdmin(identity, configuration, f.factory));
    expect(f.source.createQueryRunner).not.toHaveBeenCalled();
    expect(f.users.save).not.toHaveBeenCalled();
  });

  it('keeps query text independent of operator inputs and performs no DDL', async () => {
    const f = fixture();
    await bootstrapFirstAdmin(identity, configuration, f.factory);
    for (const [sql] of f.runner.query.mock.calls) {
      expect(
        /\b(?:ALTER|DROP|CREATE|TRUNCATE|INSERT|UPDATE|DELETE)\b/iu.test(sql),
      ).toBe(false);
      for (const value of [identity.name, identity.email, identity.password]) {
        expect(sql.includes(value)).toBe(false);
      }
    }
    expect(
      f.runner.query.mock.calls.some(
        ([sql, parameters]) =>
          sql.includes('GET_LOCK') &&
          parameters?.[0] === 'dc-system.bootstrap-admin.v1',
      ),
    ).toBe(true);
    expect(
      f.runner.query.mock.calls.some(
        ([sql, parameters]) =>
          sql.includes('RELEASE_LOCK') &&
          parameters?.[0] === 'dc-system.bootstrap-admin.v1',
      ),
    ).toBe(true);
  });

  it('models two concurrent invocations with fake exclusion while admitting only one writer', async () => {
    const rows: Rows = { roles: [role(1, 'Admin')], users: [] };
    const namedLock: NamedLock = {};
    let acquired!: () => void;
    let proceed!: () => void;
    const firstHasLock = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    const holdFirst = new Promise<void>((resolve) => {
      proceed = resolve;
    });
    const first = fixture({
      rows,
      namedLock,
      lockAcquired: acquired,
      pauseAfterLock: holdFirst,
    });
    const second = fixture({ rows, namedLock });
    const firstRun = bootstrapFirstAdmin(
      identity,
      configuration,
      first.factory,
    );
    await firstHasLock;
    try {
      const error = await failureOf(
        bootstrapFirstAdmin(identity, configuration, second.factory),
      );
      expect(error.code).toBe('BOOTSTRAP_IN_PROGRESS');
      expect(second.users.save).not.toHaveBeenCalled();
    } finally {
      proceed();
    }
    expect(await firstRun).toEqual({ userId: 17 });
    expect(rows.users.length).toBe(1);
    expect(namedLock.owner).toBeUndefined();
  });
});
