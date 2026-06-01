import { PartialType } from '@nestjs/mapped-types';
import { CreateProductColorDto } from './create-product-color.dto';

export class UpdateProductColorDto extends PartialType(CreateProductColorDto) {}
