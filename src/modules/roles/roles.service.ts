import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { EntityManager, Not, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import {
  isActiveAccount,
  isAssignableRoleName,
  isReservedRoleName,
} from '../auth/authorization.policy';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
  ) {}

  // All user/role writers acquire this same lock first. No count-only invariant.
  async withAdminTransaction<T>(
    actorId: number | undefined,
    operation: (manager: EntityManager, adminRole: Role) => Promise<T>,
  ): Promise<T> {
    if (
      actorId === undefined ||
      !Number.isSafeInteger(actorId) ||
      actorId <= 0
    ) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.roleRepository.manager.transaction(async (manager) => {
      const adminRole = await manager.getRepository(Role).findOne({
        where: { name: 'Admin' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!adminRole || adminRole.name !== 'Admin') {
        throw new ForbiddenException(
          'El rol administrativo no está disponible',
        );
      }
      const actor = await manager.getRepository(User).findOne({
        where: { userId: actorId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!actor || !isActiveAccount(actor.state)) {
        throw new UnauthorizedException('Usuario no autenticado');
      }
      if (actor.roleId !== adminRole.roleId) {
        throw new ForbiddenException('Se requiere un administrador vigente');
      }
      return operation(manager, adminRole);
    });
  }

  async findAssignableRole(id: number, manager: EntityManager): Promise<Role> {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException('El rol debe ser un entero positivo');
    }
    const role = await manager.getRepository(Role).findOne({
      where: { roleId: id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!role || !isAssignableRoleName(role.name)) {
      throw new ForbiddenException('El rol solicitado no está autorizado');
    }
    return role;
  }

  async create(createRoleDto: CreateRoleDto, actorId?: number) {
    try {
      return await this.withAdminTransaction(actorId, async (manager) => {
        const roles = manager.getRepository(Role);
        if (
          isReservedRoleName(createRoleDto.name) &&
          !isAssignableRoleName(createRoleDto.name)
        ) {
          throw new ForbiddenException('El nombre del rol está reservado');
        }
        const exists = await roles.exists({
          where: { name: createRoleDto.name },
        });
        if (exists) {
          throw new ConflictException('El nombre del rol ya existe');
        }
        const role = roles.create({ name: createRoleDto.name });
        return await roles.save(role);
      });
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('El rol ya existe');
      }
      throw new InternalServerErrorException('Error al crear el rol');
    }
  }

  async findAll(limit: number = 10, page: number = 1 ) {
    const take = limit;
    const skip = (page - 1 ) * limit;
    const rol = await this.roleRepository.findAndCount({
      take,
      skip
    });
    const [roles, total] = rol
    return {roles, total,take,skip,lastPage: Math.ceil(total/take)}
  }

  async findOne(id: number) {
    try {
      const rol = await this.roleRepository.findOneBy({ roleId: id });
      if (!rol) {
        throw new NotFoundException('el id del rol no existe');
      }
      return rol;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al obtener los roles');
    }
  }

  async update(id: number, updateRoleDto: UpdateRoleDto, actorId?: number) {
    try {
      return await this.withAdminTransaction(actorId, async (manager) => {
        const roles = manager.getRepository(Role);
        const role = await roles.findOne({
          where: { roleId: id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!role) throw new NotFoundException('El id del rol no existe');
        if (
          isReservedRoleName(role.name) ||
          (updateRoleDto.name !== undefined &&
            isReservedRoleName(updateRoleDto.name))
        ) {
          throw new ForbiddenException(
            'No se pueden modificar roles reservados',
          );
        }
        if (!updateRoleDto.name || role.name === updateRoleDto.name) {
          throw new BadRequestException(
            'Los datos enviados son iguales a los registrados actualmente',
          );
        }
        const exists = await roles.exists({
          where: { name: updateRoleDto.name, roleId: Not(id) },
        });
        if (exists) throw new ConflictException('El nombre del rol ya existe');
        role.name = updateRoleDto.name;
        return await roles.save(role);
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al actualizar el rol');
    }
  }

  async remove(id: number, actorId?: number) {
    return this.withAdminTransaction(actorId, async (manager) => {
      const roles = manager.getRepository(Role);
      const role = await roles.findOne({
        where: { roleId: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!role) throw new NotFoundException('El id del rol no existe');
      if (isReservedRoleName(role.name)) {
        throw new ForbiddenException('No se pueden eliminar roles reservados');
      }
      await roles.remove(role);
      return `el Rol ha sido elimado`;
    });
  }
}
