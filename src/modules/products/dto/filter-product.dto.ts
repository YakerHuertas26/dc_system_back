
import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

export class FilterProductDto{
    @IsOptional()
    @Type(()=> Number)
    @IsInt({message: 'El id de la categoría debe ser un número entero'})
    // @Min(1, {message: 'El id de la categoría no existe'})
    category_id? : number;
    
}