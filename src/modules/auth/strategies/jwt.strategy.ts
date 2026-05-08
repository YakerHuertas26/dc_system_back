import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { StringValue } from 'ms';

export interface JwtPayload {
  sub: number;
  name: string;
  roleName: string;
  role: number;
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
      secretOrKey: configService.get<string>('JWT_SECRET') as StringValue,
    });
  }
  async validate(payload: JwtPayload) {
    // Verificar que el payload tiene la estructura correcta
    if (!payload || !payload.sub) {
      throw new UnauthorizedException(
        'Token inválido. Por favor inicie sesión nuevamente.',
      );
    }

    try {
      // / Validar que el usuario existe y está activo
      const user = this.authService.validateUser(payload.sub);

      // Este objeto se adjunta a request.user en los controllers
      return {
        userId: payload.sub,
        name: payload.name,
        roleName: payload.roleName,
        role: payload.role,
        user,
      };
    } catch (error) {
        // Si validateUser lanza error, convertirlo a UnauthorizedException
        throw new UnauthorizedException(
        'Usuario no autenticado. Por favor inicie sesión.'
      );
    }
  }
}
