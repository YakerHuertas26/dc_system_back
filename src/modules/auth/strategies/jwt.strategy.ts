import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { assertCurrentRole } from '../authorization.policy';
import { validateJwtSecret } from '../../../config/runtime-config';

export interface JwtPayload {
  sub: number;
  name: string;
  roleName: string;
  roleId: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      // Extraer el token del header Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // rechaza los token expirados
      ignoreExpiration: false,

      // clave secreta
      secretOrKey: validateJwtSecret(configService.get('JWT_SECRET')),
    });
  }
  async validate(payload: JwtPayload) {
    // Verificar que el payload tiene la estructura correcta
    if (!payload || !Number.isSafeInteger(payload.sub) || payload.sub <= 0) {
      throw new UnauthorizedException(
        'Token inválido. Por favor inicie sesión nuevamente.',
      );
    }

    const user = await this.authService.validateUser(payload.sub);
    if (!user || user.userId !== payload.sub) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    assertCurrentRole(user);

    // Claims describe login time; only current server data grants permissions.
    return {
      userId: user.userId,
      name: user.name,
      roleName: user.role.name,
      roleId: user.roleId,
      user,
    };
  }
}
