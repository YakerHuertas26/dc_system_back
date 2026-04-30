import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty({ message: 'El nombre de usuario es requerido' })
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'El nombre de usuario debe ser una cadena de texto' })
  @Length(1, 45, {
    message: 'El nombre de usuario debe tener entre 1 y 45 caracteres',
  })
  name!: string;

  @IsNotEmpty({ message: 'El correo electrónico es requerido' })
  @Transform(({ value }) => value?.trim())
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @Length(1, 50, {
    message: 'El correo electrónico debe tener entre 1 y 50 caracteres',
  })
  email!: string;

  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @Transform(({ value }) => value?.trim())
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'La contraseña debe contener al menos: una mayúscula, una minúscula, un número y un carácter especial',
  })
  password!: string;

  @IsNotEmpty({ message: 'El rol es requerido' })
  @Type(() => Number)
  @IsInt({ message: 'El rol debe ser un número entero' })
  roleId!: number;
}
