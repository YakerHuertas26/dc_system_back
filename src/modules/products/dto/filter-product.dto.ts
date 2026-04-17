
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class FilterProductDto{
    @IsOptional()
    @Type(()=> Number)
    @IsInt({message: 'El id de la categoría debe ser un número entero'})
    // @Min(1, {message: 'El id de la categoría no existe'})
    category_id? : number;

    @IsOptional()
    @Type(()=> Number)
    @IsInt()
    product_state?:number 

    @IsOptional()
    @IsString()
    search?: string
}