import { Transform, Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Length } from "class-validator";

export class CreateProductDto {
    @Transform(({value})=>value?.trim())
    @IsNotEmpty({message: 'El nombre del producto es requerido'})
    @IsString({message:'El nombre del producto debe ser una cadena de texto'})
    @Length(1,45,{message:'El nombre del producto debe tener entre 1 y 45 caracteres'})
    name!: string;

    @IsOptional()
    @IsString({message:'La descripción del producto debe ser una cadena de texto'})
    description! : string;

    @IsNotEmpty({message:'El precio de venta del producto es requerido'})
    @Type(()=> Number)
    @IsNumber({maxDecimalPlaces:2},{message:'El precio de venta del producto debe ser un número con 2 decimales como máximo'})
    @IsPositive({message:'El precio de venta del producto debe ser un número positivo'})
    salePrice!: number;

    @IsNotEmpty({message:'El precio de compra del producto es requerido'})
    @Type(()=> Number)
    @IsNumber({maxDecimalPlaces:2},{message:'El precio de compra del producto debe ser un número con 2 decimales como máximo'})
    @IsPositive({message:'El precio de compra del producto debe ser un número positivo'})
    purchasePrice!: number;

    @IsNotEmpty({ message: 'La categoría es obligatoria' })
    @Type(() => Number)
    @IsInt({ message: 'El ID de categoría debe ser un número entero' })
    @IsPositive({ message: 'El ID de categoría debe ser positivo' })
    categoryId!: number;

    @IsNotEmpty({ message: 'El estado del producto es obligatorio' })
    @Type(() => Number)
    @IsInt({ message: 'El ID del estado debe ser un número entero' })
    @IsPositive({ message: 'El ID del estado debe ser positivo' })
    productStateId!: number;

}
