import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
    // @IsNotEmpty({message: 'El nombre de la categoría es requerido'})
    @IsOptional()
    @IsString({message: 'El nombre de la categoría debe ser una cadena de texto'})
    @Length(1,45,{message: 'El nombre de la categoría debe tener entre 1 y 45 caracteres'})
    name: string;

}
