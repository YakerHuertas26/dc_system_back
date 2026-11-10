import 'reflect-metadata';
import { Repository } from 'typeorm';
import { CategoriesController } from '../../categories/categories.controller';
import { CategoriesService } from '../../categories/categories.service';
import { ProductStatesController } from '../../product-states/product-states.controller';
import { ProductStatesService } from '../../product-states/product-states.service';
import { ProductStates } from '../../product-states/entities/product-states.entity';
import { SuppliersController } from '../../suppliers/suppliers.controller';
import { SuppliersService } from '../../suppliers/suppliers.service';
import { ProductsController } from '../products.controller';
import { ProductsService } from '../products.service';
import { Product } from '../entities/product.entity';

// All private values are synthetic. Controllers are real; their service boundary
// is replaced so no application bootstrap, datasource or listener is needed.
function fixture() {
  const category = {
    categoryId: 3,
    code: '0003',
    name: 'Synthetic category',
    state: true,
    products: [] as unknown[],
    bankAccount: 'SYNTHETIC-CATEGORY-BANK',
  };
  const productState = {
    productStateId: 2,
    name: 'Disponible',
    products: [] as unknown[],
    password: 'SYNTHETIC-STATE-PRIVATE',
  };
  const supplier = {
    supplierId: 4,
    name: 'Synthetic supplier',
    ruc: '00000000000',
    phone: '000000000',
    bankAccount: 'SYNTHETIC-ADMIN-BANK',
    state: true,
    password: 'SYNTHETIC-SUPPLIER-PRIVATE',
    privateConfiguration: 'SYNTHETIC-CONFIGURATION',
    products: [] as unknown[],
  };
  const product = {
    productId: 9,
    code: '00030009',
    name: 'Synthetic product',
    description: 'Public description',
    // mysql2 decimal values can be strings despite the entity annotations.
    salePrice: '24.50',
    purchasePrice: '10.20',
    categoryId: 3,
    productStateId: 2,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    category,
    productState,
    supplier,
    margin: 'SYNTHETIC-MARGIN',
    password: 'SYNTHETIC-PRODUCT-PRIVATE',
    bankAccount: 'SYNTHETIC-PRODUCT-BANK',
  };
  category.products.push(product);
  productState.products.push(product);
  supplier.products.push(product);
  return { product, category, productState, supplier };
}

const expectedCategory = {
  categoryId: 3,
  code: '0003',
  name: 'Synthetic category',
  state: true,
};
const expectedState = { productStateId: 2, name: 'Disponible' };
const expectedPublicProduct = {
  productId: 9,
  code: '00030009',
  name: 'Synthetic product',
  description: 'Public description',
  salePrice: '24.50',
  categoryId: 3,
  productStateId: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  category: expectedCategory,
  productState: expectedState,
};
const expectedAdminSupplier = {
  supplierId: 4,
  name: 'Synthetic supplier',
  ruc: '00000000000',
  phone: '000000000',
  bankAccount: 'SYNTHETIC-ADMIN-BANK',
  state: true,
};

function serialized(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function productsHarness() {
  const data = fixture();
  const service = {
    create: jest.fn().mockResolvedValue(data.product),
    findAll: jest.fn().mockResolvedValue({
      products: [data.product],
      total: 12,
      page: 2,
      limit: 5,
      lastPage: 3,
      privateConfiguration: 'SYNTHETIC-ENVELOPE-PRIVATE',
    }),
    findOne: jest.fn().mockResolvedValue(data.product),
    update: jest.fn().mockResolvedValue(data.product),
    remove: jest.fn().mockResolvedValue(data.product),
  };
  return {
    data,
    service,
    controller: new ProductsController(service as unknown as ProductsService),
  };
}

describe('T02-B product response privacy', () => {
  it('keeps public prices, identifiers and safe relations without private or cyclic fields', async () => {
    const { controller, service } = productsHarness();
    const result = await controller.findOne('9');
    expect(serialized(result)).toEqual(expectedPublicProduct);
    expect(service.findOne).toHaveBeenCalledWith(9);
  });

  it('keeps filters and product pagination while projecting every listed product', async () => {
    const { controller, service } = productsHarness();
    const result = await controller.findAll({
      category_id: 3,
      product_state: 2,
      search: '  public search  ',
      take: 5,
      page: 2,
    });
    expect(serialized(result)).toEqual({
      products: [expectedPublicProduct],
      total: 12,
      page: 2,
      limit: 5,
      lastPage: 3,
    });
    expect(service.findAll).toHaveBeenCalledWith(
      3,
      2,
      '  public search  ',
      5,
      2,
    );
  });

  it('preserves an empty public catalogue and its pagination', async () => {
    const { controller, service } = productsHarness();
    service.findAll.mockResolvedValue({
      products: [],
      total: 0,
      page: 1,
      limit: 10,
      lastPage: 0,
    });
    expect(serialized(await controller.findAll({}))).toEqual({
      products: [],
      total: 0,
      page: 1,
      limit: 10,
      lastPage: 0,
    });
  });

  it('preserves a numeric sale price including zero', async () => {
    const { controller, service, data } = productsHarness();
    service.findOne.mockResolvedValue({ ...data.product, salePrice: 0 });
    expect(serialized(await controller.findOne('9'))).toEqual({
      ...expectedPublicProduct,
      salePrice: 0,
    });
  });

  it('preserves null relations without falling back to internal data', async () => {
    const { controller, service, data } = productsHarness();
    service.findOne.mockResolvedValue({
      ...data.product,
      category: null,
      productState: null,
    });
    expect(serialized(await controller.findOne('9'))).toEqual({
      ...expectedPublicProduct,
      category: null,
      productState: null,
    });
  });

  it('omits unloaded relations without erasing the public product fields', async () => {
    const { controller, service, data } = productsHarness();
    service.findOne.mockResolvedValue({
      ...data.product,
      category: undefined,
      productState: undefined,
    });
    expect(serialized(await controller.findOne('9'))).toEqual({
      productId: 9,
      code: '00030009',
      name: 'Synthetic product',
      description: 'Public description',
      salePrice: '24.50',
      categoryId: 3,
      productStateId: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('does not invoke entity toJSON when producing a public response', async () => {
    const { controller, service, data } = productsHarness();
    const toJSON = jest.fn(() => ({ password: 'SYNTHETIC-TOJSON-PRIVATE' }));
    service.findOne.mockResolvedValue(Object.assign(data.product, { toJSON }));
    expect(serialized(await controller.findOne('9'))).toEqual(
      expectedPublicProduct,
    );
    expect(toJSON).not.toHaveBeenCalled();
  });

  it.each(['create', 'update', 'remove'] as const)(
    'preserves the internal acquisition price in the Admin %s response without leaking other fields',
    async (operation) => {
      const { controller } = productsHarness();
      const input = {
        name: 'Synthetic product',
        description: 'Public description',
        salePrice: 24.5,
        purchasePrice: 10.2,
        categoryId: 3,
        productStateId: 2,
      };
      const response =
        operation === 'create'
          ? await controller.create(input)
          : operation === 'update'
            ? await controller.update('9', input)
            : await controller.remove('9');
      expect(serialized(response)).toEqual({
        ...expectedPublicProduct,
        purchasePrice: '10.20',
      });
    },
  );
});

function suppliersHarness() {
  const data = fixture();
  const service = {
    create: jest.fn().mockResolvedValue(data.supplier),
    findAll: jest.fn().mockResolvedValue({
      suppliers: [data.supplier],
      total: 12,
      take: 5,
      skip: 5,
      lastPage: 3,
      password: 'SYNTHETIC-ENVELOPE-PRIVATE',
    }),
    findOne: jest.fn().mockResolvedValue(data.supplier),
    update: jest.fn().mockResolvedValue(data.supplier),
    active: jest
      .fn()
      .mockResolvedValue('El estado del suppliers a sido activado'),
    remove: jest.fn().mockResolvedValue('El proovedor ha sido Eliminado'),
  };
  return {
    service,
    controller: new SuppliersController(service as unknown as SuppliersService),
  };
}

describe('T02-B administrative supplier response boundary', () => {
  it('retains authorized banking/contact fields while excluding unknown fields and inverse relations', async () => {
    const { controller } = suppliersHarness();
    expect(serialized(await controller.findOne('4'))).toEqual(
      expectedAdminSupplier,
    );
  });

  it('preserves supplier take/skip pagination instead of product page/limit fields', async () => {
    const { controller, service } = suppliersHarness();
    expect(serialized(await controller.findAll({ take: 5, page: 2 }))).toEqual({
      suppliers: [expectedAdminSupplier],
      total: 12,
      take: 5,
      skip: 5,
      lastPage: 3,
    });
    expect(service.findAll).toHaveBeenCalledWith(5, 2);
  });

  it('preserves an empty supplier result', async () => {
    const { controller, service } = suppliersHarness();
    service.findAll.mockResolvedValue({
      suppliers: [],
      total: 0,
      take: 10,
      skip: 0,
      lastPage: 0,
    });
    expect(serialized(await controller.findAll({}))).toEqual({
      suppliers: [],
      total: 0,
      take: 10,
      skip: 0,
      lastPage: 0,
    });
  });

  it.each(['create', 'update'] as const)(
    'projects supplier %s responses using the same administrative contract',
    async (operation) => {
      const { controller } = suppliersHarness();
      const input = {
        name: 'Synthetic supplier',
        ruc: '0000000000',
        phone: '000000000',
        bankAccount: '0000000000',
      };
      const result =
        operation === 'create'
          ? await controller.create(input)
          : await controller.update('4', input);
      expect(serialized(result)).toEqual(expectedAdminSupplier);
    },
  );

  it('preserves existing supplier reactivation and deletion message responses', async () => {
    const { controller } = suppliersHarness();
    expect(await controller.active('4')).toBe(
      'El estado del suppliers a sido activado',
    );
    expect(await controller.remove('4')).toBe('El proovedor ha sido Eliminado');
  });
});

function categoriesHarness() {
  const data = fixture();
  const service = {
    create: jest.fn().mockResolvedValue(data.category),
    findAll: jest.fn().mockResolvedValue({
      categories: [data.category],
      total: 12,
      take: 5,
      skip: 5,
      lastPage: 3,
      bankAccount: 'SYNTHETIC-ENVELOPE-PRIVATE',
    }),
    findOne: jest.fn().mockResolvedValue(data.category),
    update: jest.fn().mockResolvedValue(data.category),
    active: jest.fn().mockResolvedValue(data.category),
    remove: jest.fn().mockResolvedValue(data.category),
  };
  return {
    service,
    controller: new CategoriesController(
      service as unknown as CategoriesService,
    ),
  };
}

describe('T02-B category inverse-relation privacy', () => {
  it('keeps the frontend code/name/state contract without nested acquisition costs', async () => {
    const { controller } = categoriesHarness();
    expect(serialized(await controller.findOne('3'))).toEqual(expectedCategory);
  });

  it('preserves the category state filter and existing pagination', async () => {
    const { controller, service } = categoriesHarness();
    const result = await controller.findAll({ state: false, take: 5, page: 2 });
    expect(serialized(result)).toEqual({
      categories: [expectedCategory],
      total: 12,
      take: 5,
      skip: 5,
      lastPage: 3,
    });
    expect(service.findAll).toHaveBeenCalledWith(false, 5, 2);
  });

  it('preserves an empty category result', async () => {
    const { controller, service } = categoriesHarness();
    service.findAll.mockResolvedValue({
      categories: [],
      total: 0,
      take: 10,
      skip: 0,
      lastPage: 0,
    });
    expect(serialized(await controller.findAll())).toEqual({
      categories: [],
      total: 0,
      take: 10,
      skip: 0,
      lastPage: 0,
    });
  });

  it.each(['create', 'update', 'active', 'remove'] as const)(
    'does not reintroduce inverse product relations through category %s responses',
    async (operation) => {
      const { controller } = categoriesHarness();
      const result =
        operation === 'create'
          ? await controller.create({ name: 'Synthetic category' })
          : operation === 'update'
            ? await controller.update('3', { name: 'Synthetic category' })
            : operation === 'active'
              ? await controller.active('3')
              : await controller.remove('3');
      expect(serialized(result)).toEqual(expectedCategory);
    },
  );
});

function statesHarness() {
  const data = fixture();
  const service = {
    create: jest.fn().mockResolvedValue(data.productState),
    findAll: jest.fn().mockResolvedValue({
      stateProducts: [data.productState],
      total: 12,
      take: 5,
      skip: 5,
      lastPage: 3,
      password: 'SYNTHETIC-ENVELOPE-PRIVATE',
    }),
    findOne: jest.fn().mockResolvedValue(data.productState),
    update: jest.fn().mockResolvedValue(data.productState),
    remove: jest.fn().mockResolvedValue({
      message: 'El estado del producto ha sido eliminado',
    }),
  };
  return {
    service,
    controller: new ProductStatesController(
      service as unknown as ProductStatesService,
    ),
  };
}

describe('T02-B product-state inverse-relation privacy', () => {
  it('keeps identifiers/names without an inverse product collection', async () => {
    const { controller } = statesHarness();
    expect(serialized(await controller.findOne('2'))).toEqual(expectedState);
  });

  it('preserves the stateProducts envelope and pagination', async () => {
    const { controller, service } = statesHarness();
    expect(serialized(await controller.findAll({ take: 5, page: 2 }))).toEqual({
      stateProducts: [expectedState],
      total: 12,
      take: 5,
      skip: 5,
      lastPage: 3,
    });
    expect(service.findAll).toHaveBeenCalledWith(5, 2);
  });

  it('preserves an empty product-state result', async () => {
    const { controller, service } = statesHarness();
    service.findAll.mockResolvedValue({
      stateProducts: [],
      total: 0,
      take: 10,
      skip: 0,
      lastPage: 0,
    });
    expect(serialized(await controller.findAll({}))).toEqual({
      stateProducts: [],
      total: 0,
      take: 10,
      skip: 0,
      lastPage: 0,
    });
  });

  it.each(['create', 'update'] as const)(
    'keeps product-state %s responses free of inverse products',
    async (operation) => {
      const { controller } = statesHarness();
      const result =
        operation === 'create'
          ? await controller.create({ name: 'Disponible' })
          : await controller.update('2', { name: 'Disponible' });
      expect(serialized(result)).toEqual(expectedState);
    },
  );

  it('preserves the existing product-state deletion message object', async () => {
    const { controller } = statesHarness();
    expect(await controller.remove('2')).toEqual({
      message: 'El estado del producto ha sido eliminado',
    });
  });
});

describe('T02-B public projection does not alter internal product updates', () => {
  function serviceHarness() {
    const data = fixture();
    const stored = data.product as unknown as Product;
    const repository = {
      findOne: jest.fn().mockResolvedValue(stored),
      exists: jest.fn().mockResolvedValue(false),
      save: jest.fn((value: Product) => Promise.resolve(value)),
    };
    const stateRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ productStateId: 5, name: 'Agotado' }),
    };
    const service = new ProductsService(
      repository as unknown as Repository<Product>,
      stateRepository as unknown as Repository<ProductStates>,
      {} as CategoriesService,
      {} as ProductStatesService,
    );
    return { stored, repository, service };
  }

  it('keeps the original entity and its acquisition price for internal findOne', async () => {
    const { stored, service } = serviceHarness();
    const result = await service.findOne(9);
    expect(result).toBe(stored);
    expect(result.purchasePrice).toBe('10.20');
  });

  it('does not erase acquisition prices while updating unrelated fields', async () => {
    const { stored, repository, service } = serviceHarness();
    const result = await service.update(9, {
      description: 'Updated description',
    });
    expect(result).toBe(stored);
    expect(result.description).toBe('Updated description');
    expect(result.purchasePrice).toBe('10.20');
    expect(repository.save).toHaveBeenCalledWith(stored);
  });

  it('does not erase acquisition prices while marking a product exhausted', async () => {
    const { stored, repository, service } = serviceHarness();
    const result = await service.remove(9);
    expect(result).toBe(stored);
    expect(result.productState.name).toBe('Agotado');
    expect(result.purchasePrice).toBe('10.20');
    expect(repository.save).toHaveBeenCalledWith(stored);
  });

  it('does not write acquisition costs or entity relations to the console on removal', async () => {
    const { service } = serviceHarness();
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await service.remove(9);
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
