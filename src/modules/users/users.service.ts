import {
  BadRequestException,
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
import { isEqueals } from '@/common/utils/compare';

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
        throw new ConflictException('El correo del usuario ya existe');
      }
      const user = this.userRepository.create({ ...createUserDto, role });
      const saveUser = await this.userRepository.save(user);
      const { password, ...result } = saveUser;
      return result;
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

  async update(id: number, updateUserDto: UpdateUserDto) {
    try {
      const user = await this.findOne(id);
      const isEqueal = isEqueals(user, updateUserDto)
      if(isEqueal) throw new BadRequestException('Los datos enviados son iguales a los registrados actualmente.')

      if (updateUserDto.email) {
        const existEmail = await this.userRepository.exists({
          where: {
            email: updateUserDto.email,
            userId: Not(id),
          },
        });
        if (existEmail)
          throw new ConflictException(
            'El correo del usuario ya existe',
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
      throw new InternalServerErrorException('Error al actualizar el usuario');
    }
  }

  async remove(id: number) {
    const user = await this.findOne(id);
    user.state = false;
    return await this.userRepository.save(user);
  }
}
