import { ForbiddenException } from '@nestjs/common';
import type { User } from '../users/entities/user.entity';

// D018: custom catalogue entries do not grant permissions until approved.
export const ASSIGNABLE_ROLE_NAMES = ['Admin', 'Vendedor'] as const;

export interface AuthenticatedRequest {
  user?: { userId: number; roleName?: string };
}

export function isActiveAccount(state: unknown): boolean {
  return state === true || state === 1;
}

export function isAssignableRoleName(name: unknown): boolean {
  return ASSIGNABLE_ROLE_NAMES.some((allowed) => allowed === name);
}

export function isReservedRoleName(name: string): boolean {
  return ASSIGNABLE_ROLE_NAMES.some(
    (reserved) => reserved.toLowerCase() === name.trim().toLowerCase(),
  );
}

export function assertCurrentRole(user: Pick<User, 'roleId' | 'role'>): void {
  if (
    !Number.isSafeInteger(user.roleId) ||
    user.roleId <= 0 ||
    !user.role ||
    user.role.roleId !== user.roleId ||
    !isAssignableRoleName(user.role.name)
  ) {
    throw new ForbiddenException(
      'El usuario no tiene un rol autorizado vigente',
    );
  }
}
