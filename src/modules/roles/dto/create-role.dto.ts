import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Length } from "class-validator";

export class CreateRoleDto {
    @Transform(({value})=>value?.trim())
    @IsNotEmpty({message:'El nombre del rol es requerido'})
    @IsString({message:'El nombre del rol debe ser una cadena de texto'})
    @Length(1,45,{message:'El nombre del rol debe tener entre 1 y 45 carácteres'})
    name!: string
}
