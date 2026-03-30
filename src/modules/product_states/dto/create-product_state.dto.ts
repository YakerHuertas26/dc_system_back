import { IsNotEmpty, IsString, Length,  } from "class-validator";

export class CreateProductStateDto {
    @IsNotEmpty({message: 'El nombre del estado del estado del producto es requerido'})
    @IsString({message: 'El nombre del estado del producto debe ser una cadena de texto'})
    @Length(1,45,{message: 'el nombre del estado del producto debe tener entre 1 y 45 caracteres'})
    name: string;
}
