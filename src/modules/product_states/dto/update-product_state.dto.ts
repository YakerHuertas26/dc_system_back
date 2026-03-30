import { PartialType } from '@nestjs/mapped-types';
import { CreateProductStateDto } from './create-product_state.dto';

export class UpdateProductStateDto extends PartialType(CreateProductStateDto) {}
