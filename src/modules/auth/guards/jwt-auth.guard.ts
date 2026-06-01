import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Verificar si la ruta es pública
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Validar JWT
    return super.canActivate(context);
  }

  /**
   * Manejo de errores personalizado
   */
  handleRequest(err: any, user: any, info: any) {
    // Si hay un error o no hay usuario, lanzar UnauthorizedException
    if (err || !user) {
      
      // Mensajes específicos según el tipo de error
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Token expirado. Por favor inicie sesión nuevamente.'
        );
      }

      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException(
          'Token inválido. Por favor inicie sesión nuevamente.'
        );
      }

      if (info?.message === 'No auth token') {
        throw new UnauthorizedException(
          'Usuario no autenticado. Por favor inicie sesión.'
        );
      }

      // Error genérico
      throw err || new UnauthorizedException(
        'Usuario no autenticado. Por favor inicie sesión.'
      );
    }

    return user;
  }
}

