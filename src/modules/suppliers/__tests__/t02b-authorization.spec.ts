import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { AuthService } from '../../auth/auth.service';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtPayload, JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { ProductsController } from '../../products/products.controller';
import { ProductsService } from '../../products/products.service';
import { Role } from '../../roles/entities/role.entity';
import { RolesService } from '../../roles/roles.service';
import { User } from '../../users/entities/user.entity';
import { SuppliersController } from '../suppliers.controller';
import { SuppliersService } from '../suppliers.service';

type Route = 'create' | 'findAll' | 'findOne' | 'active' | 'update' | 'remove';
type Controller = typeof SuppliersController | typeof ProductsController;
type ServiceDouble = Record<Route, jest.Mock>;

const supplierRoutes: Route[] = [
  'create',
  'findAll',
  'findOne',
  'active',
  'update',
  'remove',
];

interface RequestWithIdentity {
  headers: { authorization?: string };
  user?: { userId: number; roleName: string };
}

// This is an isolated authorization pipeline, not an HTTP integration test.
// Passport, JWT verification, metadata and application guards are real; only
// repositories and downstream business services are replaced. No AppModule.
describe('T02-B supplier authorization and product access regression', () => {
  let currentUser: User | null;
  let userRepository: { findOne: jest.Mock };
  let jwt: JwtService;
  let jwtGuard: JwtAuthGuard;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;
  let suppliers: SuppliersController;
  let products: ProductsController;
  let supplierService: ServiceDouble;
  let productService: ServiceDouble;

  const supplier = {
    supplierId: 31,
    name: 'Synthetic supplier',
    ruc: '00000000000',
    phone: '000000000',
    bankAccount: 'synthetic-account-not-real',
    state: true,
  };
  const product = {
    productId: 41,
    code: '00010041',
    name: 'Synthetic product',
    description: 'Fixture only',
    salePrice: 25,
    purchasePrice: 10,
    categoryId: 1,
    productStateId: 2,
    category: { categoryId: 1, code: '0001', name: 'Category', state: true },
    productState: { productStateId: 2, name: 'Available' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  beforeEach(() => {
    currentUser = Object.assign(new User(), {
      userId: 17,
      name: 'current-user',
      email: 'current@example.invalid',
      state: true,
      roleId: 7,
      role: Object.assign(new Role(), { roleId: 7, name: 'Admin' }),
    });
    userRepository = {
      findOne: jest.fn(({ where }: { where: { userId: number } }) =>
        Promise.resolve(where.userId === 17 ? currentUser : null),
      ),
    };
    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    const auth = new AuthService(
      userRepository as unknown as Repository<User>,
      jwt,
      {} as RolesService,
    );
    new JwtStrategy(new ConfigService({ JWT_SECRET: secret }), auth);
    reflector = new Reflector();
    jwtGuard = new JwtAuthGuard(reflector);
    rolesGuard = new RolesGuard(reflector);
    supplierService = {
      create: jest.fn().mockResolvedValue({ ...supplier }),
      findAll: jest.fn().mockResolvedValue({
        suppliers: [{ ...supplier }],
        total: 1,
        take: 10,
        skip: 0,
        lastPage: 1,
      }),
      findOne: jest.fn().mockResolvedValue({ ...supplier }),
      active: jest
        .fn()
        .mockResolvedValue('El estado del suppliers a sido activado'),
      update: jest.fn().mockResolvedValue({ ...supplier, name: 'Updated' }),
      remove: jest.fn().mockResolvedValue('El proovedor ha sido Eliminado'),
    };
    productService = {
      create: jest.fn().mockResolvedValue({ ...product }),
      findAll: jest.fn().mockResolvedValue({
        products: [{ ...product }],
        total: 1,
        page: 1,
        limit: 10,
        lastPage: 1,
      }),
      findOne: jest.fn().mockResolvedValue({ ...product }),
      active: jest.fn(),
      update: jest.fn().mockResolvedValue({ ...product }),
      remove: jest.fn().mockResolvedValue({ ...product }),
    };
    suppliers = new SuppliersController(
      supplierService as unknown as SuppliersService,
    );
    products = new ProductsController(
      productService as unknown as ProductsService,
    );
  });

  function sign(overrides: Partial<JwtPayload> = {}) {
    return jwt.sign(
      {
        sub: 17,
        name: 'identity-at-login',
        roleId: 7,
        roleName: 'Admin',
        ...overrides,
      },
      { expiresIn: '5m' },
    );
  }

  function replaceRole(name: string, roleId: number) {
    currentUser = Object.assign(new User(), {
      ...currentUser!,
      roleId,
      role: Object.assign(new Role(), { roleId, name }),
    });
  }

  async function authorize(
    controller: Controller,
    route: Route,
    token?: string,
  ) {
    const request: RequestWithIdentity = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    };
    const handler = Reflect.get(controller.prototype, route) as () => unknown;
    const context = {
      getClass: () => controller,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
      getType: () => 'http',
    } as unknown as ExecutionContext;
    await jwtGuard.canActivate(context);
    const registeredGuards = [
      ...(reflector.get<unknown[]>(GUARDS_METADATA, controller) ?? []),
      ...(reflector.get<unknown[]>(GUARDS_METADATA, handler) ?? []),
    ];
    for (const registeredGuard of registeredGuards) {
      if (registeredGuard !== RolesGuard) {
        throw new Error('Unexpected guard; update the isolated route harness.');
      }
      rolesGuard.canActivate(context);
    }
    return request;
  }

  function expectNoBusinessCalls() {
    for (const service of [supplierService, productService]) {
      for (const method of Object.values(service)) {
        expect(method).not.toHaveBeenCalled();
      }
    }
  }

  async function expectDenied(action: Promise<unknown>, status: number) {
    let failure: unknown;
    try {
      await action;
    } catch (error) {
      failure = error;
    }
    // Do not print requests, signed tokens or raw authentication errors.
    expect(failure instanceof HttpException).toBe(true);
    expect((failure as HttpException).getStatus()).toBe(status);
    expectNoBusinessCalls();
  }

  async function dispatchSupplier(route: Route, token?: string) {
    await authorize(SuppliersController, route, token);
    switch (route) {
      case 'create':
        return suppliers.create({ name: 'New', ruc: '0000000000' });
      case 'findAll':
        return suppliers.findAll({ take: 10, page: 1 });
      case 'findOne':
        return suppliers.findOne('31');
      case 'active':
        return suppliers.active('31');
      case 'update':
        return suppliers.update('31', { name: 'Updated' });
      case 'remove':
        return suppliers.remove('31');
    }
  }

  async function dispatchProduct(
    route: 'create' | 'update' | 'remove',
    token?: string,
  ) {
    await authorize(ProductsController, route, token);
    switch (route) {
      case 'create':
        return products.create({
          name: 'New product',
          description: 'Fixture',
          salePrice: 25,
          purchasePrice: 10,
          categoryId: 1,
          productStateId: 2,
        });
      case 'update':
        return products.update('41', { salePrice: 30 });
      case 'remove':
        return products.remove('41');
    }
  }

  describe.each(supplierRoutes)('supplier %s', (route) => {
    it('is private and declares the effective Admin guard', () => {
      const handler = SuppliersController.prototype[route];
      expect(
        reflector.getAllAndOverride(IS_PUBLIC_KEY, [
          handler,
          SuppliersController,
        ]),
      ).not.toBe(true);
      expect(
        reflector.getAllAndOverride(ROLES_KEY, [handler, SuppliersController]),
      ).toEqual(['Admin']);
      expect(
        reflector.getAllAndOverride(GUARDS_METADATA, [
          handler,
          SuppliersController,
        ]),
      ).toContain(RolesGuard);
    });

    it('denies anonymous access before calling a business service', async () => {
      await expectDenied(dispatchSupplier(route), 401);
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('denies a current Vendedor before calling a business service', async () => {
      replaceRole('Vendedor', 9);
      await expectDenied(
        dispatchSupplier(route, sign({ roleName: 'Vendedor', roleId: 9 })),
        403,
      );
    });

    it('allows an active current Admin', async () => {
      await expect(dispatchSupplier(route, sign())).resolves.toBeDefined();
      expect(supplierService[route]).toHaveBeenCalledTimes(1);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 17 },
        relations: { role: true },
      });
    });

    it.each(['Supervisor', 'Unknown'])(
      'does not grant authority to %s',
      async (roleName) => {
        replaceRole(roleName, 23);
        await expectDenied(dispatchSupplier(route, sign()), 403);
      },
    );

    it('denies an inactive account despite its Admin claims', async () => {
      currentUser!.state = false;
      await expectDenied(dispatchSupplier(route, sign()), 401);
    });

    it('denies a deleted account despite its Admin claims', async () => {
      currentUser = null;
      await expectDenied(dispatchSupplier(route, sign()), 401);
    });

    it('denies a deleted role despite its Admin claims', async () => {
      currentUser!.role = null as unknown as Role;
      await expectDenied(dispatchSupplier(route, sign()), 403);
    });

    it('revokes the same Admin token on the next request after demotion', async () => {
      const token = sign();
      await expect(
        authorize(SuppliersController, route, token),
      ).resolves.toBeDefined();
      replaceRole('Vendedor', 9);
      await expectDenied(dispatchSupplier(route, token), 403);
      expect(userRepository.findOne).toHaveBeenCalledTimes(2);
    });
  });

  it('preserves supplier creation arguments and its response identifier', async () => {
    const result = await dispatchSupplier('create', sign());
    expect(supplierService.create).toHaveBeenCalledWith({
      name: 'New',
      ruc: '0000000000',
    });
    expect(result).toMatchObject({
      supplierId: 31,
      name: 'Synthetic supplier',
    });
  });

  it('preserves supplier update arguments and its response identifier', async () => {
    const result = await dispatchSupplier('update', sign());
    expect(supplierService.update).toHaveBeenCalledWith(31, {
      name: 'Updated',
    });
    expect(result).toMatchObject({ supplierId: 31, name: 'Updated' });
  });

  it('preserves supplier reactivation and deletion messages', async () => {
    await expect(dispatchSupplier('active', sign())).resolves.toBe(
      'El estado del suppliers a sido activado',
    );
    await expect(dispatchSupplier('remove', sign())).resolves.toBe(
      'El proovedor ha sido Eliminado',
    );
    expect(supplierService.active).toHaveBeenCalledWith(31);
    expect(supplierService.remove).toHaveBeenCalledWith(31);
  });

  it.each(['findAll', 'findOne'] as const)(
    'keeps product %s public without reading identity',
    async (route) => {
      const handler = ProductsController.prototype[route];
      expect(
        reflector.getAllAndOverride(IS_PUBLIC_KEY, [
          handler,
          ProductsController,
        ]),
      ).toBe(true);
      await expect(authorize(ProductsController, route)).resolves.toEqual({
        headers: {},
      });
      expect(userRepository.findOne).not.toHaveBeenCalled();
      expectNoBusinessCalls();
    },
  );

  describe.each(['create', 'update', 'remove'] as const)(
    'product %s',
    (route) => {
      it('continues to require an authenticated Admin', () => {
        const handler = ProductsController.prototype[route];
        expect(
          reflector.getAllAndOverride(IS_PUBLIC_KEY, [
            handler,
            ProductsController,
          ]),
        ).not.toBe(true);
        expect(
          reflector.getAllAndOverride(ROLES_KEY, [handler, ProductsController]),
        ).toEqual(['Admin']);
        expect(
          reflector.getAllAndOverride(GUARDS_METADATA, [
            handler,
            ProductsController,
          ]),
        ).toContain(RolesGuard);
      });

      it('prevents anonymous mutations', async () => {
        await expectDenied(dispatchProduct(route), 401);
      });

      it('prevents Vendedor mutations', async () => {
        replaceRole('Vendedor', 9);
        await expectDenied(dispatchProduct(route, sign()), 403);
      });

      it('allows mutations by a current Admin', async () => {
        await expect(dispatchProduct(route, sign())).resolves.toBeDefined();
        expect(productService[route]).toHaveBeenCalledTimes(1);
      });
    },
  );
});
