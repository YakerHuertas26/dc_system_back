import { ProductStates } from '../entities/product-states.entity';

export type ProductStateResponseDto = Pick<
  ProductStates,
  'productStateId' | 'name'
>;

export function toProductStateResponse(
  productState: ProductStates,
): ProductStateResponseDto {
  return {
    productStateId: productState.productStateId,
    name: productState.name,
  };
}
