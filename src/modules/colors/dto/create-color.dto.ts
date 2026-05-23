import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Length } from "class-validator";

export class CreateColorDto {
    @Transform(({value})=> value.trim())
    @IsNotEmpty({message:'El campo es requerido'})
    @IsString({message:'El nombre debe ser una cadena de texto'})
    @Length(1,45,{message:'el nombre debe tener entre 1 a 45 cáracteres'})
    name! : string
    
    @Transform(({value})=> value.trim())
    @IsNotEmpty({message:'El campo es requerido'})
    @IsString({message:'El código debe ser una cadena de texto'})
    @Length(1,7,{message:'el código debe tener entre 1 a 7 cáracteres'})
    code!: string
}
