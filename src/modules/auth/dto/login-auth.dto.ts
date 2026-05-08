import { Transform } from "class-transformer"
import { IsNotEmpty, IsString, Length } from "class-validator"

export class LoginAuthDto{

    @IsNotEmpty({message:'El nombre de usuario es requerido'})
    @Transform(({value}) => value?.trim())
    @IsString({message:'El nombre de usuario debe ser una cadena de texto'})
    @Length(1,45,{message:'El nombre de usuario debe tener entre 1 y 45 caracteres'})
    name!: string

    @IsNotEmpty({message:'La contraseña es requerida'})
    @Transform(({value}) => value?.trim())
    password!: string
}