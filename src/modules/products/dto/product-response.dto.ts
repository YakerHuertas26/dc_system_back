import {
  CategoryResponseDto,
  toCategoryResponse,
} from '../../categories/dto/category-response.dto';
import {
  ProductStateResponseDto,
  toProductStateResponse,
} from '../../product-states/dto/product-state-response.dto';
import { Product } from '../entities/product.entity';

export type PublicProductResponseDto = Pick<
  Product,
  | 'productId'
  | 'code'
  | 'name'
  | 'description'
  | 'salePrice'
  | 'categoryId'
  | 'productStateId'
  | 'createdAt'
  | 'updatedAt'
> & {
  category: CategoryResponseDto | null | undefined;
  productState: ProductStateResponseDto | null | undefined;
};

export type AdminProductResponseDto = PublicProductResponseDto &
  Pick<Product, 'purchasePrice'>;

// Build new plain objects; never serialize entities or inverse relations.
// Keep DECIMAL/date values as received, without conversion or rounding.
export function toPublicProductResponse(
  product: Product,
): PublicProductResponseDto {
  return {
    productId: product.productId,
    code: product.code,
    name: product.name,
    description: product.description,
    salePrice: product.salePrice,
    categoryId: product.categoryId,
    productStateId: product.productStateId,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    category:
      product.category == null
        ? product.category
        : toCategoryResponse(product.category),
    productState:
      product.productState == null
        ? product.productState
        : toProductStateResponse(product.productState),
  };
}

// Used only by the existing Admin-guarded mutations, never by public GETs.
export function toAdminProductResponse(
  product: Product,
): AdminProductResponseDto {
  return {
    // The spread source is the explicit public DTO, never a TypeORM entity.
    ...toPublicProductResponse(product),
    purchasePrice: product.purchasePrice,
  };
}
