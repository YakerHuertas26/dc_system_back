import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

export class PaginationColorDto{
    @IsOptional()
    @Type(()=> Number)
    @IsInt({message:'el take debe ser un número entero'})
    @Min(1,{message:'El take de ser un número pasitivo'})
    take? : number

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El valor de skip debe ser un número entero' })
    @Min(1, { message: 'El skip debe ser al menos 1' })
    page? : number
}