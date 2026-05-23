import {
  ConflictException,
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

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly roleService: RolesService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const role = await this.roleService.findOne(createUserDto.roleId);
      const existEmail = await this.userRepository.exists({
        where: { email: createUserDto.email },
      });
      if (existEmail) {
        throw new ConflictException('El correo electrónico ya está registrado');
      }
      const user = this.userRepository.create({ ...createUserDto, role });
      const saveUser = await this.userRepository.save(user);
      const { password, ...result } = saveUser;
      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error?.code === 'ER_DUP_ENTRY')
        throw new ConflictException('El correo electrónico ya está registrado');
      throw new InternalServerErrorException('Error al crear usuario');
    }
  }

  async findAll() {
    return await this.userRepository.find({
      relations: {
        role: true,
      },
    });
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
        throw new NotFoundException('El usuario no ha sido encontrado');

      return user;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al obtener usuario');
    }
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    try {
      const user = await this.findOne(id);
      // if (user === updateUserDto)
      //   throw new ConflictException('No hay datos para actualizar');

      if (updateUserDto.email) {
        const existEmail = await this.userRepository.exists({
          where: {
            email: updateUserDto.email,
            userId: Not(id),
          },
        });
        if (existEmail)
          throw new ConflictException(
            'El correo electrónico ya está registrado',
          );
      }
      if (updateUserDto.roleId) {
        const role = await this.roleService.findOne(updateUserDto.roleId);
        user.role = role;
      }
      Object.assign(user, updateUserDto);
      const saveUser = await this.userRepository.save(user);
      const { password, ...result } = saveUser;
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al actualizar usuario');
    }
  }

  async remove(id: number) {
    const user = await this.findOne(id);
    user.state = false;
    return await this.userRepository.save(user);
  }
}
