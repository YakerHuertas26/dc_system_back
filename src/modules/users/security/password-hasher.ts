import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// All new credentials enter here as plaintext. A bcrypt-looking prefix is data,
// never evidence that input is trusted or already hashed.
export async function hashNewPassword(value: unknown): Promise<string> {
  if (
    typeof value !== 'string' ||
    Array.from(value).length < 8 ||
    Buffer.byteLength(value, 'utf8') > 72 ||
    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/u.test(
      value,
    )
  ) {
    throw new BadRequestException(
      'La contraseña no cumple los requisitos de seguridad',
    );
  }
  try {
    return await bcrypt.hash(value, 10);
  } catch {
    throw new InternalServerErrorException('No se pudo proteger la contraseña');
  }
}
