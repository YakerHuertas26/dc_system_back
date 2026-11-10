import { Categories } from '../entities/categories.entity';

export type CategoryResponseDto = Pick<
  Categories,
  'categoryId' | 'code' | 'name' | 'state'
>;

export function toCategoryResponse(category: Categories): CategoryResponseDto {
  return {
    categoryId: category.categoryId,
    code: category.code,
    name: category.name,
    state: category.state,
  };
}
