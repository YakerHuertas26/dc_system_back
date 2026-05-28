import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, IsBoolean, Min } from "class-validator";

export class paginationCategoryDto {
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean({ message: 'El valor de state debe ser un booleano' })
    // reemplaza el pipe
    @Transform(({ value }) => {                           
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value; // si viene otro valor, @IsBoolean lo rechaza
    })

    state?: boolean;

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