import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { JwtPayload, JwtStrategy } from '../strategies/jwt.strategy';
import { Role } from '../../roles/entities/role.entity';
import { RolesController } from '../../roles/roles.controller';
import { RolesService } from '../../roles/roles.service';
import { User } from '../../users/entities/user.entity';
import { UsersController } from '../../users/users.controller';
import { UsersService } from '../../users/users.service';
import { hashNewPassword } from '../../users/security/password-hasher';

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: {
    userId: number;
    name: string;
    roleId: number;
    roleName: string;
    user: User;
  };
}

type Controller = typeof UsersController | typeof RolesController;
type Route = 'create' | 'findAll' | 'findOne' | 'update' | 'remove';

// Exercise the application's actual Passport strategy and guards. Only the
// repository boundary is replaced: no AppModule, datasource or HTTP listener.
describe('T02-A authorization regression', () => {
  let currentUser: User | null;
  let auth: AuthService;
  let jwt: JwtService;
  let guard: JwtAuthGuard;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;
  let repository: {
    findOne: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    remove: jest.Mock;
  };
  let createUser: jest.Mock;
  let createRole: jest.Mock;

  beforeEach(() => {
    const role = Object.assign(new Role(), { roleId: 7, name: 'Admin' });
    currentUser = Object.assign(new User(), {
      userId: 17,
      name: 'current-user',
      email: 'current@example.invalid',
      state: true,
      roleId: 7,
      role,
      createAt: new Date('2026-01-01T00:00:00.000Z'),
      updateAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    repository = {
      findOne: jest.fn(
        ({ where }: { where: { userId?: number; name?: string } }) =>
          Promise.resolve(
            where.userId === 17 || where.name === 'current-user'
              ? currentUser
              : null,
          ),
      ),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
    };
    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    auth = new AuthService(
      repository as unknown as Repository<User>,
      jwt,
      {} as RolesService,
    );
    // Construction registers the actual named Passport JWT strategy.
    new JwtStrategy(new ConfigService({ JWT_SECRET: secret }), auth);
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
    rolesGuard = new RolesGuard(reflector);
    createUser = jest.fn();
    createRole = jest.fn();
  });

  function sign(overrides: Partial<JwtPayload> = {}) {
    return jwt.sign(
      {
        sub: 17,
        name: 'name-at-login',
        roleId: 7,
        roleName: 'Admin',
        ...overrides,
      },
      { expiresIn: '5m' },
    );
  }

  function contextFor(
    request: AuthenticatedRequest,
    controller: Controller = UsersController,
    route: Route = 'findAll',
  ) {
    return {
      getClass: () => controller,
      getHandler: () => controller.prototype[route],
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
      getType: () => 'http',
    } as unknown as ExecutionContext;
  }

  async function authorize(
    token?: string,
    controller: Controller = UsersController,
    route: Route = 'findAll',
  ) {
    const request: AuthenticatedRequest = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    };
    const context = contextFor(request, controller, route);
    await guard.canActivate(context);
    const registeredGuards =
      reflector.getAllAndOverride<unknown[]>(GUARDS_METADATA, [
        context.getHandler(),
        controller,
      ]) ?? [];
    for (const registeredGuard of registeredGuards) {
      if (registeredGuard !== RolesGuard) {
        throw new Error('Unexpected route guard; update the test harness.');
      }
      rolesGuard.canActivate(context);
    }
    return request;
  }

  function expectNoMutations() {
    expect(createUser).not.toHaveBeenCalled();
    expect(createRole).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
    expect(repository.remove).not.toHaveBeenCalled();
  }

  async function expectDenied(action: Promise<unknown>, status: number) {
    let failure: unknown;
    try {
      await action;
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(HttpException);
    expect((failure as HttpException).getStatus()).toBe(status);
    expectNoMutations();
  }

  async function dispatchCreation(controller: Controller, token?: string) {
    const request = await authorize(token, controller, 'create');
    if (controller === UsersController) {
      const instance = new UsersController({
        create: createUser,
      } as unknown as UsersService);
      return instance.create(
        {
          name: 'attempt',
          email: 'attempt@example.invalid',
          password: 'Synthetic-not-persisted-27!',
          roleId: 7,
        },
        request,
      );
    }
    const instance = new RolesController({
      create: createRole,
    } as unknown as RolesService);
    return instance.create({ name: 'Admin' }, request);
  }

  it('rejects an anonymous request on an authenticated route with 401', async () => {
    await expectDenied(authorize(), 401);
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('rejects a malformed token before looking up a user', async () => {
    await expectDenied(authorize('not-a-jwt'), 401);
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('rejects a payload altered after signing before looking up a user', async () => {
    const [header, payload, signature] = sign().split('.');
    const changedPayload = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
        sub: 99,
      }),
    ).toString('base64url');
    await expectDenied(
      authorize([header, changedPayload, signature].join('.')),
      401,
    );
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('rejects a token signed by another key before looking up a user', async () => {
    const otherSigner = new JwtService({
      secret: randomBytes(32).toString('hex'),
    });
    const token = otherSigner.sign({ sub: 17, roleName: 'Admin', roleId: 7 });
    await expectDenied(authorize(token), 401);
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('rejects an expired token before looking up a user', async () => {
    const token = jwt.sign({
      sub: 17,
      roleName: 'Admin',
      roleId: 7,
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    await expectDenied(authorize(token), 401);
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('rejects an unsigned token before looking up a user', async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: 17, roleName: 'Admin', roleId: 7 }),
    ).toString('base64url');
    await expectDenied(authorize(`${header}.${payload}.`), 401);
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('allows an active current Admin and uses current identity information', async () => {
    const request = await authorize(sign());
    expect(request.user).toMatchObject({
      userId: 17,
      name: 'current-user',
      roleId: 7,
      roleName: 'Admin',
    });
    expect(repository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 17 },
        relations: { role: true },
      }),
    );
    expectNoMutations();
  });

  it('revokes Admin access on the next request after demotion to Vendedor', async () => {
    const token = sign();
    await expect(authorize(token)).resolves.toBeDefined();
    // Replace the database record, rather than mutate the old object in memory;
    // an accidentally cached identity must not satisfy this regression.
    currentUser = Object.assign(new User(), {
      ...currentUser!,
      roleId: 9,
      role: Object.assign(new Role(), { roleId: 9, name: 'Vendedor' }),
    });
    await expectDenied(authorize(token), 403);
    expect(repository.findOne).toHaveBeenCalledTimes(2);
  });

  it('allows a promoted current Admin while its older Vendedor token is valid', async () => {
    const request = await authorize(sign({ roleName: 'Vendedor', roleId: 9 }));
    expect(request.user).toMatchObject({ roleName: 'Admin', roleId: 7 });
    expectNoMutations();
  });

  it('rejects an inactive account with 401 despite an Admin token', async () => {
    currentUser!.state = false;
    await expectDenied(authorize(sign()), 401);
  });

  it('rejects a deleted account with 401 despite a still-valid token', async () => {
    currentUser = null;
    await expectDenied(authorize(sign()), 401);
  });

  it.each([
    ['missing subject', undefined],
    ['zero subject', 0],
    ['negative subject', -17],
    ['string subject', '17'],
    ['fractional subject', 17.5],
    ['unsafe integer subject', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects an invalid identity: %s', async (_label, sub) => {
    const token = jwt.sign({ sub, roleName: 'Admin', roleId: 7 });
    await expectDenied(authorize(token), 401);
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('accepts the active MySQL tinyint representation 1', async () => {
    currentUser!.state = 1 as unknown as boolean;
    const request = await authorize(sign());
    expect(request.user).toMatchObject({ userId: 17, roleName: 'Admin' });
    expectNoMutations();
  });

  it('rejects an inconsistent current account identity with 401', async () => {
    currentUser!.userId = 99;
    await expectDenied(authorize(sign()), 401);
  });

  it('denies a deleted role without falling back to Admin claims', async () => {
    currentUser!.role = null as unknown as Role;
    await expectDenied(authorize(sign()), 403);
  });

  it('denies an unknown current role without falling back to Admin claims', async () => {
    currentUser!.role = Object.assign(new Role(), {
      roleId: 19,
      name: 'Unknown',
    });
    currentUser!.roleId = 19;
    await expectDenied(authorize(sign()), 403);
  });

  it('denies an inconsistent role relation instead of accepting its Admin name', async () => {
    currentUser!.roleId = 9;
    await expectDenied(authorize(sign()), 403);
  });

  it('does not implicitly grant Admin privileges to Supervisor', async () => {
    currentUser!.role = Object.assign(new Role(), {
      roleId: 23,
      name: 'Supervisor',
    });
    currentUser!.roleId = 23;
    await expectDenied(authorize(sign()), 403);
  });

  it('RolesGuard denies a missing authenticated user with a controlled 401', () => {
    const context = contextFor({ headers: {} });
    expect(() => rolesGuard.canActivate(context)).toThrow(HttpException);
    try {
      rolesGuard.canActivate(context);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(401);
    }
    expectNoMutations();
  });

  describe.each([
    ['users', UsersController],
    ['roles', RolesController],
  ] as const)('%s route protection', (_name, controller) => {
    it.each<Route>(['create', 'findAll', 'findOne', 'update', 'remove'])(
      '%s is private and applies the Admin guard',
      (route) => {
        const handler = controller.prototype[route];
        expect(
          reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, controller]),
        ).not.toBe(true);
        expect(
          reflector.getAllAndOverride(ROLES_KEY, [handler, controller]),
        ).toEqual(['Admin']);
        expect(
          reflector.getAllAndOverride(GUARDS_METADATA, [handler, controller]),
        ).toContain(RolesGuard);
      },
    );

    it('denies public creation before any controller/service mutation', async () => {
      await expectDenied(dispatchCreation(controller), 401);
    });

    it('denies creation by a current Vendedor even when the body selects Admin roleId', async () => {
      currentUser!.roleId = 9;
      currentUser!.role = Object.assign(new Role(), {
        roleId: 9,
        name: 'Vendedor',
      });
      await expectDenied(
        dispatchCreation(controller, sign({ roleName: 'Vendedor', roleId: 9 })),
        403,
      );
    });

    it('allows its creation guards for a current Admin', async () => {
      const request = await authorize(sign(), controller, 'create');
      expect(request.user).toMatchObject({ userId: 17, roleName: 'Admin' });
      expectNoMutations();
    });

    it('passes the current authenticated actor to its creation service', async () => {
      await dispatchCreation(controller, sign());
      const mutation = controller === UsersController ? createUser : createRole;
      expect(mutation).toHaveBeenCalledTimes(1);
      expect(mutation).toHaveBeenCalledWith(expect.any(Object), 17);
    });

    it.each(['update', 'remove'] as const)(
      'passes the current authenticated actor to its %s service',
      async (route) => {
        const request = await authorize(sign(), controller, route);
        const update = jest.fn();
        const remove = jest.fn();
        const instance =
          controller === UsersController
            ? new UsersController({ update, remove } as unknown as UsersService)
            : new RolesController({
                update,
                remove,
              } as unknown as RolesService);
        if (route === 'update') {
          await instance.update('31', { name: 'updated' }, request);
          expect(update).toHaveBeenCalledWith(31, { name: 'updated' }, 17);
        } else {
          await instance.remove('31', request);
          expect(remove).toHaveBeenCalledWith(31, 17);
        }
      },
    );
  });

  it('keeps the existing login route public', async () => {
    const request: AuthenticatedRequest = { headers: {} };
    const context = {
      getClass: () => AuthController,
      getHandler: () =>
        Reflect.get(AuthController.prototype, 'login') as unknown,
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
    await expect(Promise.resolve(guard.canActivate(context))).resolves.toBe(
      true,
    );
    expect(repository.findOne).not.toHaveBeenCalled();
    expectNoMutations();
  });

  describe('existing login contract', () => {
    let password: string;

    beforeEach(async () => {
      password = `${randomBytes(24).toString('hex')}A1!`;
      currentUser!.password = await hashNewPassword(password);
    });

    it('keeps userAutorised/accessToken, omits password and signs a verifiable token', async () => {
      const result = await auth.login({ name: 'current-user', password });
      expect(Object.keys(result).sort()).toEqual([
        'accessToken',
        'userAutorised',
      ]);
      expect(
        Object.prototype.hasOwnProperty.call(result.userAutorised, 'password'),
      ).toBe(false);
      expect(result.userAutorised).toMatchObject({
        userId: 17,
        name: 'current-user',
        roleId: 7,
      });
      const verified = jwt.verify<Record<string, unknown>>(result.accessToken);
      expect(verified).toMatchObject({
        sub: 17,
        name: 'current-user',
        roleId: 7,
        roleName: 'Admin',
      });
      expectNoMutations();
    });

    it('rejects an incorrect password with 401 and no mutation', async () => {
      await expectDenied(
        auth.login({ name: 'current-user', password: `${password}incorrect` }),
        401,
      );
    });

    it('rejects valid credentials for an inactive account with 401', async () => {
      currentUser!.state = false;
      await expectDenied(auth.login({ name: 'current-user', password }), 401);
    });

    it('rejects valid credentials with a deleted role using controlled 403', async () => {
      currentUser!.role = null as unknown as Role;
      await expectDenied(auth.login({ name: 'current-user', password }), 403);
    });

    it('rejects valid credentials with an unknown role using controlled 403', async () => {
      currentUser!.role = Object.assign(new Role(), {
        roleId: 19,
        name: 'Unknown',
      });
      currentUser!.roleId = 19;
      await expectDenied(auth.login({ name: 'current-user', password }), 403);
    });
  });
});
