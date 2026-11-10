import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Not, Repository } from 'typeorm';
import { RolesService } from '../roles/roles.service';
import { isEqueals } from '@/common/utils/compare';
import { hashNewPassword } from './security/password-hasher';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly roleService: RolesService,
  ) {}

  async create(createUserDto: CreateUserDto, actorId?: number) {
    try {
      return await this.roleService.withAdminTransaction(
        actorId,
        async (manager) => {
          const users = manager.getRepository(User);
          const role = await this.roleService.findAssignableRole(
            createUserDto.roleId,
            manager,
          );
          const exists = await users.exists({
            where: { email: createUserDto.email },
          });
          if (exists)
            throw new ConflictException('El correo del usuario ya existe');
          const user = users.create({
            name: createUserDto.name,
            email: createUserDto.email,
            password: await hashNewPassword(createUserDto.password),
            roleId: role.roleId,
            role,
          });
          const saved = await users.save(user);
          const { password, ...result } = saved;
          return result;
        },
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error?.code === 'ER_DUP_ENTRY')
        throw new ConflictException('El correo electrónico ya está registrado');
      throw new InternalServerErrorException('Error al crear el usuario');
    }
  }

  async findAll(limit: number = 10, page: number = 1) {
    const take= limit;
    const skip = (page - 1) * limit;
    const user= await this.userRepository.findAndCount({
      relations: {
        role: true,
      },
      take,
      skip
    });
    const [users, total] = user;
    return {users, total, take, skip, lastPage: Math.ceil(total/take)}
  }

  async findOne(id: number) {
    try {
      const user = await this.userRepository.findOne({
        where: { userId: id },
        relations: {
          role: true,
        },
      });
      if (!user)
        throw new NotFoundException('El id del usuario ya existe');

      return user;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al obtener usuario');
    }
  }

  async update(id: number, updateUserDto: UpdateUserDto, actorId?: number) {
    try {
      return await this.roleService.withAdminTransaction(
        actorId,
        async (manager, adminRole) => {
          const users = manager.getRepository(User);
          const user = await users.findOne({
            where: { userId: id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!user) throw new NotFoundException('El id del usuario no existe');
          if (user.roleId === adminRole.roleId) {
            if (user.userId !== actorId) {
              throw new ForbiddenException(
                'La modificación de otro administrador está bloqueada temporalmente',
              );
            }
            if (
              updateUserDto.roleId !== undefined &&
              updateUserDto.roleId !== adminRole.roleId
            ) {
              throw new ForbiddenException(
                'No puede cambiar su propio rol administrativo',
              );
            }
          }
          const changes: UpdateUserDto = {};
          for (const key of ['name', 'email', 'password'] as const) {
            if (updateUserDto[key] !== undefined)
              changes[key] = updateUserDto[key];
          }
          if (updateUserDto.roleId !== undefined) {
            const role = await this.roleService.findAssignableRole(
              updateUserDto.roleId,
              manager,
            );
            changes.roleId = role.roleId;
            user.role = role;
          }
          if (isEqueals(user, changes)) {
            throw new BadRequestException(
              'Los datos enviados son iguales a los registrados actualmente.',
            );
          }
          if (changes.email) {
            const exists = await users.exists({
              where: { email: changes.email, userId: Not(id) },
            });
            if (exists)
              throw new ConflictException('El correo del usuario ya existe');
          }
          if (changes.password !== undefined) {
            changes.password = await hashNewPassword(changes.password);
          }
          Object.assign(user, changes);
          const saved = await users.save(user);
          const { password, ...result } = saved;
          return result;
        },
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al actualizar el usuario');
    }
  }

  async remove(id: number, actorId?: number) {
    return this.roleService.withAdminTransaction(
      actorId,
      async (manager, adminRole) => {
        const users = manager.getRepository(User);
        const user = await users.findOne({
          where: { userId: id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) throw new NotFoundException('El id del usuario no existe');
        if (user.roleId === adminRole.roleId) {
          throw new ForbiddenException(
            'No se puede desactivar a un administrador',
          );
        }
        user.state = false;
        const saved = await users.save(user);
        const { password, ...result } = saved;
        void password;
        return result;
      },
    );
  }
}
