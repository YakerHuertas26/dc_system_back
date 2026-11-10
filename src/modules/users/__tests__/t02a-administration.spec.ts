import 'reflect-metadata';
import { FindOperator, Repository } from 'typeorm';
import { RolesService } from '../../roles/roles.service';
import { Role } from '../../roles/entities/role.entity';
import { UsersService } from '../users.service';
import { User } from '../entities/user.entity';

type Row = User | Role;
type Options = {
  where?: Record<string, unknown>;
  lock?: { mode?: string };
};

// These doubles model persistence boundaries, not MySQL lock semantics.
function fixture() {
  const role = (roleId: number, name: string) =>
    Object.assign(new Role(), { roleId, name, user: [] });
  const roles = new Map<number, Role>([
    [1, role(1, 'Admin')],
    [2, role(2, 'Vendedor')],
    [3, role(3, 'Supervisor')],
    [4, role(4, 'CatalogOnly')],
  ]);
  const user = (userId: number, roleId: number, state = true) =>
    Object.assign(new User(), {
      userId,
      name: `person${userId}`,
      email: `person${userId}@example.invalid`,
      roleId,
      role: roles.get(roleId),
      state,
      createAt: new Date('2026-01-01T00:00:00Z'),
      updateAt: new Date('2026-01-01T00:00:00Z'),
    });
  const users = new Map<number, User>([
    [1, user(1, 1)],
    [2, user(2, 1)],
    [3, user(3, 2)],
    [4, user(4, 2, false)],
    [5, user(5, 3)],
  ]);
  const events: string[] = [];
  let failSave = false;
  let queue = Promise.resolve();
  const matches = (row: Row, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([key, value]) => {
      const actual = (row as unknown as Record<string, unknown>)[key];
      return value instanceof FindOperator && value.type === 'not'
        ? actual !== value.value
        : actual === value;
    });
  const copyUser = (value: User) => Object.assign(new User(), value);
  const copyRole = (value: Role) => Object.assign(new Role(), value);

  function repository(kind: 'user' | 'role', transactional: boolean) {
    const rows = (): Row[] =>
      kind === 'user' ? [...users.values()] : [...roles.values()];
    const label = `${transactional ? 'tx' : 'outside'}:${kind}`;
    const findOne = jest.fn((options: Options) => {
      const row = rows().find((entry) => matches(entry, options.where));
      events.push(
        `${label}:read:${row ? (kind === 'user' ? (row as User).userId : (row as Role).roleId) : 'missing'}:${options.lock?.mode ?? 'none'}`,
      );
      if (!row) return Promise.resolve(null);
      if (kind === 'role') return Promise.resolve(copyRole(row as Role));
      const result = copyUser(row as User);
      result.role = roles.get(result.roleId) as Role;
      return Promise.resolve(result);
    });
    const result = {
      manager: {} as unknown,
      findOne,
      findOneBy: jest.fn((where: Record<string, unknown>) =>
        findOne({ where }),
      ),
      exists: jest.fn((options: Options) =>
        Promise.resolve(rows().some((entry) => matches(entry, options.where))),
      ),
      count: jest.fn((options: Options = {}) =>
        Promise.resolve(
          rows().filter((entry) => matches(entry, options.where)).length,
        ),
      ),
      create: jest.fn((data: Partial<Row>) =>
        Object.assign(kind === 'user' ? new User() : new Role(), data),
      ),
      save: jest.fn((data: Row) => {
        events.push(`${label}:save`);
        if (failSave)
          return Promise.reject(new Error('Synthetic persistence failure'));
        if (kind === 'user') {
          const input = data as User;
          const id = input.userId ?? Math.max(...users.keys()) + 1;
          const saved = Object.assign(new User(), users.get(id), input, {
            userId: id,
          });
          saved.roleId = input.roleId ?? input.role?.roleId;
          saved.role = roles.get(saved.roleId) as Role;
          saved.state ??= true;
          users.set(id, copyUser(saved));
          return Promise.resolve(copyUser(saved));
        }
        const input = data as Role;
        const id = input.roleId ?? Math.max(...roles.keys()) + 1;
        const saved = Object.assign(new Role(), roles.get(id), input, {
          roleId: id,
        });
        roles.set(id, copyRole(saved));
        return Promise.resolve(copyRole(saved));
      }),
      remove: jest.fn((data: Role) => {
        events.push(`${label}:remove`);
        roles.delete(data.roleId);
        return Promise.resolve(data);
      }),
    };
    return result;
  }

  const txUsers = repository('user', true);
  const txRoles = repository('role', true);
  const outerUsers = repository('user', false);
  const outerRoles = repository('role', false);
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === User) return txUsers;
      if (entity === Role) return txRoles;
      throw new Error('Unexpected entity');
    }),
  };
  const transaction = jest.fn(
    async (work: (value: typeof manager) => Promise<unknown>) => {
      const predecessor = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await predecessor;
      const beforeUsers = [...users].map(
        ([id, value]) => [id, copyUser(value)] as const,
      );
      const beforeRoles = [...roles].map(
        ([id, value]) => [id, copyRole(value)] as const,
      );
      events.push('transaction:start');
      try {
        const value = await work(manager);
        events.push('transaction:commit');
        return value;
      } catch (error) {
        users.clear();
        roles.clear();
        beforeUsers.forEach(([id, value]) => users.set(id, value));
        beforeRoles.forEach(([id, value]) => roles.set(id, value));
        events.push('transaction:rollback');
        throw error;
      } finally {
        release();
      }
    },
  );
  outerUsers.manager = { transaction };
  outerRoles.manager = { transaction };
  txUsers.manager = manager;
  txRoles.manager = manager;
  const rolesService = new RolesService(
    outerRoles as unknown as Repository<Role>,
  );
  const usersService = new UsersService(
    outerUsers as unknown as Repository<User>,
    rolesService,
  );
  const call = (service: object, method: string, ...args: unknown[]) =>
    Reflect.apply(
      Reflect.get(service, method) as (
        ...values: unknown[]
      ) => Promise<unknown>,
      service,
      args,
    );
  const create = (roleId = 2, actorId: number | undefined = 1, extra = {}) =>
    call(
      usersService,
      'create',
      {
        name: 'created',
        email: 'created@example.invalid',
        password: 'Synthetic8!Value',
        roleId,
        ...extra,
      },
      actorId,
    );
  const createWithoutActor = () =>
    call(usersService, 'create', {
      name: 'created',
      email: 'created@example.invalid',
      password: 'Synthetic8!Value',
      roleId: 2,
    });
  const update = (
    id: number,
    patch: Record<string, unknown>,
    actorId: number | undefined = 1,
  ) => call(usersService, 'update', id, patch, actorId);
  const remove = (id: number, actorId: number | undefined = 1) =>
    call(usersService, 'remove', id, actorId);
  const createRole = (name: string, actorId: number | undefined = 1) =>
    call(rolesService, 'create', { name }, actorId);
  const updateRole = (
    id: number,
    name: string,
    actorId: number | undefined = 1,
  ) => call(rolesService, 'update', id, { name }, actorId);
  const removeRole = (id: number, actorId: number | undefined = 1) =>
    call(rolesService, 'remove', id, actorId);
  const noWrites = () => {
    for (const repo of [txUsers, txRoles, outerUsers, outerRoles]) {
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.remove).not.toHaveBeenCalled();
    }
  };
  return {
    users,
    roles,
    events,
    transaction,
    outerUsers,
    outerRoles,
    txUsers,
    txRoles,
    create,
    createWithoutActor,
    update,
    remove,
    createRole,
    updateRole,
    removeRole,
    noWrites,
    failSave: () => {
      failSave = true;
    },
  };
}

describe('T02-A administrative policies with real services and fake persistence', () => {
  it.each([3, 4, 5, 999])(
    'denies user creation by unauthorized actor %s without persistence',
    async (actor) => {
      const f = fixture();
      await expect(f.create(1, actor)).rejects.toMatchObject({
        status: actor === 4 || actor === 999 ? 401 : 403,
      });
      f.noWrites();
    },
  );

  it('denies an invalid actor even when requesting only a seller account', async () => {
    const f = fixture();
    await expect(f.create(2, Number.NaN)).rejects.toMatchObject({
      status: 401,
    });
    f.noWrites();
  });

  it('denies an absent actor without persistence', async () => {
    const f = fixture();
    await expect(f.createWithoutActor()).rejects.toMatchObject({ status: 401 });
    f.noWrites();
  });

  it('revalidates a formerly administrative actor before mutating', async () => {
    const f = fixture();
    const actor = f.users.get(1)!;
    actor.roleId = 2;
    actor.role = f.roles.get(2)!;
    await expect(f.create(1)).rejects.toMatchObject({ status: 403 });
    f.noWrites();
  });

  it.each([1, 2])(
    'allows active Admin to create a known role %s account without exposing password',
    async (roleId) => {
      const f = fixture();
      const result = await f.create(roleId);
      expect(result).toMatchObject({ roleId, name: 'created' });
      expect(result).not.toHaveProperty('password');
      expect(f.users.get(6)?.roleId).toBe(roleId);
    },
  );

  it.each([3, 4, 999])(
    'rejects assignment of unknown/deleted role %s on creation',
    async (roleId) => {
      const f = fixture();
      await expect(f.create(roleId)).rejects.toMatchObject({
        status: 403,
      });
      f.noWrites();
    },
  );

  it.each([3, 4, 999])(
    'rejects assignment of unknown/deleted role %s on update',
    async (roleId) => {
      const f = fixture();
      await expect(f.update(3, { roleId })).rejects.toMatchObject({
        status: 403,
      });
      expect(f.users.get(3)?.roleId).toBe(2);
      f.noWrites();
    },
  );

  it('prevents direct service input from mass assigning identity or active state', async () => {
    const f = fixture();
    await f.create(2, 1, { userId: 1, state: false, role: f.roles.get(1) });
    expect(f.users.get(1)?.state).toBe(true);
    expect(f.users.get(1)?.roleId).toBe(1);
    expect(f.users.get(6)?.roleId).toBe(2);
  });

  it('does not let a profile update deactivate its actor through mass assignment', async () => {
    const f = fixture();
    await f.update(1, {
      name: 'profile',
      state: false,
      userId: 999,
      role: f.roles.get(2),
    });
    expect(f.users.get(1)?.state).toBe(true);
    expect(f.users.get(1)?.roleId).toBe(1);
    expect(f.users.has(999)).toBe(false);
  });

  it('allows the current Admin to edit its own profile while preserving privileges', async () => {
    const f = fixture();
    await expect(
      f.update(1, { name: 'profile', roleId: 1 }),
    ).resolves.toMatchObject({ name: 'profile', roleId: 1 });
  });

  it('denies self degradation', async () => {
    const f = fixture();
    await expect(f.update(1, { roleId: 2 })).rejects.toMatchObject({
      status: 403,
    });
    expect(f.users.get(1)?.roleId).toBe(1);
    f.noWrites();
  });

  it('denies self deactivation', async () => {
    const f = fixture();
    await expect(f.remove(1)).rejects.toMatchObject({ status: 403 });
    expect(f.users.get(1)?.state).toBe(true);
    f.noWrites();
  });

  it.each([
    { name: 'changed' },
    { roleId: 2 },
    { password: 'Another8!Synthetic' },
  ])('temporarily denies modifying another Admin: %j', async (patch) => {
    const f = fixture();
    await expect(f.update(2, patch)).rejects.toMatchObject({ status: 403 });
    f.noWrites();
  });

  it('denies deactivating another Admin', async () => {
    const f = fixture();
    await expect(f.remove(2)).rejects.toMatchObject({ status: 403 });
    f.noWrites();
  });

  it('preserves the final active Admin without relying on a count', async () => {
    const f = fixture();
    f.users.get(2)!.state = false;
    await expect(f.remove(1)).rejects.toMatchObject({ status: 403 });
    await expect(f.update(1, { roleId: 2 })).rejects.toMatchObject({
      status: 403,
    });
    expect(f.users.get(1)?.state).toBe(true);
    f.noWrites();
  });

  it('allows an active Admin to deactivate a seller', async () => {
    const f = fixture();
    await f.remove(3);
    expect(f.users.get(3)?.state).toBe(false);
  });

  it.each([1, 2])(
    'protects reserved role %s against renaming and deletion',
    async (id) => {
      const f = fixture();
      await expect(f.updateRole(id, 'Renamed')).rejects.toMatchObject({
        status: 403,
      });
      await expect(f.removeRole(id)).rejects.toMatchObject({ status: 403 });
      f.noWrites();
    },
  );

  it.each(['Admin', 'Vendedor', ' ADMIN ', 'vEnDeDoR'])(
    'prevents custom role renaming to reserved destination %s',
    async (name) => {
      const f = fixture();
      await expect(f.updateRole(4, name)).rejects.toMatchObject({
        status: 403,
      });
      f.noWrites();
    },
  );

  it.each(['ADMIN', ' admin ', 'vendedor'])(
    'rejects reserved role spelling variant %s',
    async (name) => {
      const f = fixture();
      await expect(f.createRole(name)).rejects.toMatchObject({ status: 403 });
      f.noWrites();
    },
  );

  it.each(['Admin', 'Vendedor'])(
    'reports existing canonical role %s as conflict',
    async (name) => {
      const f = fixture();
      await expect(f.createRole(name)).rejects.toMatchObject({ status: 409 });
      f.noWrites();
    },
  );

  it('allows an active Admin to recreate a missing canonical Vendedor role', async () => {
    const f = fixture();
    f.roles.delete(2);
    await expect(f.createRole('Vendedor')).resolves.toMatchObject({
      name: 'Vendedor',
    });
  });

  it('retains the authorized custom role catalog without making it assignable', async () => {
    const f = fixture();
    await f.createRole('AuditorCatalog');
    await f.updateRole(4, 'CatalogRenamed');
    await f.removeRole(4);
    expect(
      [...f.roles.values()].some((role) => role.name === 'AuditorCatalog'),
    ).toBe(true);
    expect(f.roles.has(4)).toBe(false);
  });

  it.each(['create', 'update', 'remove'])(
    'does not grant catalog mutation %s to seller',
    async (method) => {
      const f = fixture();
      const operation =
        method === 'create'
          ? f.createRole('NoPermission', 3)
          : method === 'update'
            ? f.updateRole(4, 'NoPermission', 3)
            : f.removeRole(4, 3);
      await expect(operation).rejects.toMatchObject({ status: 403 });
      f.noWrites();
    },
  );

  it('fails closed when the reserved Admin row is absent', async () => {
    const f = fixture();
    f.roles.delete(1);
    await expect(f.create()).rejects.toMatchObject({ status: 403 });
    f.noWrites();
  });

  it('locks Admin before actor and target and writes only through the transaction manager', async () => {
    const f = fixture();
    await f.update(3, { name: 'UpdatedSeller' });
    expect(f.events[0]).toBe('transaction:start');
    expect(
      f.events
        .filter((event) => event.includes('pessimistic_write'))
        .slice(0, 3),
    ).toEqual([
      'tx:role:read:1:pessimistic_write',
      'tx:user:read:1:pessimistic_write',
      'tx:user:read:3:pessimistic_write',
    ]);
    expect(f.events.at(-1)).toBe('transaction:commit');
    expect(f.events.some((event) => event.startsWith('outside:'))).toBe(false);
    expect(f.users.get(3)?.name).toBe('UpdatedSeller');
  });

  it.each([
    'createUser',
    'updateUser',
    'removeUser',
    'createRole',
    'updateRole',
    'removeRole',
  ])(
    '%s serializes its writes behind the same Admin lock',
    async (operation) => {
      const f = fixture();
      const calls: Record<string, () => Promise<unknown>> = {
        createUser: () => f.create(),
        updateUser: () => f.update(3, { name: 'UpdatedSeller' }),
        removeUser: () => f.remove(3),
        createRole: () => f.createRole('UnusedCatalog'),
        updateRole: () => f.updateRole(4, 'UpdatedCatalog'),
        removeRole: () => f.removeRole(4),
      };
      await calls[operation]();
      expect(f.events[0]).toBe('transaction:start');
      expect(
        f.events.find((event) => event.includes('pessimistic_write')),
      ).toBe('tx:role:read:1:pessimistic_write');
      expect(f.events.at(-1)).toBe('transaction:commit');
      expect(f.events.some((event) => event.startsWith('outside:'))).toBe(
        false,
      );
    },
  );

  it('rolls back a failed write instead of leaving a changed entity behind', async () => {
    const f = fixture();
    f.failSave();
    await expect(f.update(3, { name: 'ShouldRollback' })).rejects.toMatchObject(
      { status: 500 },
    );
    expect(f.users.get(3)?.name).toBe('person3');
    expect(f.events).toContain('transaction:rollback');
    expect(f.events).not.toContain('transaction:commit');
  });

  it('rereads a newly promoted target before a queued deactivation attempt', async () => {
    const f = fixture();
    const outcomes = await Promise.allSettled([
      f.update(3, { roleId: 1 }),
      f.remove(3),
    ]);
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({
      status: 'rejected',
      reason: { status: 403 },
    });
    expect(f.users.get(3)?.roleId).toBe(1);
    expect(f.users.get(3)?.state).toBe(true);
  });
});
