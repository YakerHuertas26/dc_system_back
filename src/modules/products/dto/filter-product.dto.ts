
import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class FilterProductDto{
    @IsOptional()
    @Type(()=> Number)
    @IsInt({message: 'El id de la categoría debe ser un número entero'})
    @Min(1, {message: 'El id de la categoría debe ser un número entero positivo'})
    category_id? : number;

    @IsOptional()
    @Type(()=> Number)
    @IsInt({message: 'El id del estado del producto debe ser un número entero'})
    @Min(1, {message: 'El id del estado del producto debe ser un número entero positivo'})
    product_state?:number 

    @IsOptional()
    @IsString()
    search?: string

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El valor de take debe ser un número entero' })
    @Min(1, { message: 'El take debe ser al menos 1' })
    take?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El valor de skip debe ser un número entero' })
    @Min(1, { message: 'El skip debe ser al menos 1' })
    page?: number;
}