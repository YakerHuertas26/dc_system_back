import { PartialType } from '@nestjs/mapped-types';
import { CreateProductStateDto } from './create-product_state.dto';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class UpdateProductStateDto extends PartialType(CreateProductStateDto) {
    @Transform(({value})=> value?.trim())
    @IsNotEmpty({message: 'El nombre del estado del estado del producto es requerido'})
    @IsString({message: 'El nombre del estado del producto debe ser una cadena de texto'})
    @Length(1,45,{message: 'el nombre del estado del producto debe tener entre 1 y 45 caracteres'})
        name: string;
}
