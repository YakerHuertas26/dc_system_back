import { IsNotEmpty, IsString, Length } from "class-validator";

export class CreateCategoryDto {
    // @IsNotEmpty({message: 'El código de la categoría es requerido'})
    // @IsString({message: 'El código de la categoría debe ser una cadena de texto'})
    // @Length(4,4,{message: 'El código de la categoría debe tener exactamente 4 caracteres'})
    // code: string;

    @IsNotEmpty({message: 'El nombre de la categoría es requerido'})
    @IsString({message: 'El nombre de la categoría debe ser una cadena de texto'})
    @Length(1,45,{message: 'El nombre de la categoría debe tener entre 1 y 45 caracteres'})
    name: string;
}
