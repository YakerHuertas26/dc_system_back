import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, Length } from "class-validator";

export class CreateSupplierDto {
    @Transform(({ value }) => value?.trim())
    @IsNotEmpty({message: 'El campo es requerido'})
    @IsString({message:'el nombre debe ser un cadena de texto'})
    @Length(1,45,{message:'el nombre debe tener entre 1 a 45 caracteres'})
    name! : string;

    @Transform(({value}) => value?.trim())
    @IsNotEmpty({message:'El campo es requerido'})
    @IsString({message: 'El campo debe ser una cadena de texto'})
    @IsNotEmpty({message: 'El campo es requerido'})
    @Length(10,10,{message: 'El ruc debe tener 10 carácteres'})
    ruc! : string;

    @IsOptional()
    @Transform(({value}) => value?.trim())
    @IsString({message:'El campo es una cadena de texto'})
    @Length(1,9,{message:'El número de telefono debe tener 9 caracteres'})
    phone? : string;

    @IsOptional()
    @Transform(({value}) => value?.trim())
    @IsString({message:'El campo es una cadena de texto'})
    @Length(1,10,{message:'El número de cuenta debe tener 9 caracteres'})
    bankAccount? : string;
}
