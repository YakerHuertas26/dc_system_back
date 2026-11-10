import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { isAssignableRoleName } from '../authorization.policy';
import type { AuthenticatedRequest } from '../authorization.policy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Obtener los roles requeridos del decorador @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay roles definidos, permitir acceso
    if (!requiredRoles) {
      return true;
    }
    // Obtener el usuario del request (fue agregado por JwtStrategy)
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || !Number.isSafeInteger(user.userId) || user.userId <= 0) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    // Verificar si el usuario tiene alguno de los roles requeridos
    const hasRole =
      isAssignableRoleName(user.roleName) &&
      requiredRoles.some((role) => user.roleName === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de los siguientes roles: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}
