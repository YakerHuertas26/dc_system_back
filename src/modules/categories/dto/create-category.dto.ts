import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateCategoryDto {
  @Transform(({ value }) => value?.trim())
  @IsNotEmpty({ message: 'El nombre de la categoría es requerido' })
  @IsString({
    message: 'El nombre de la categoría debe ser una cadena de texto',
  })
  @Length(1, 45, {
    message: 'El nombre de la categoría debe tener entre 1 y 45 caracteres',
  })
  name!: string;
}