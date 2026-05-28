import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

export class paginationRoleDto {
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