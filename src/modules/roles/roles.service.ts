import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Not, Repository } from 'typeorm';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
  ) {}

  async create(createRoleDto: CreateRoleDto) {
    try {
      const exitRole = await this.roleRepository.exists({
        where: { name: createRoleDto.name },
      });
      if (exitRole) {
        throw new ConflictException('El nombre del rol ya existe');
      }

      const role = this.roleRepository.create(createRoleDto);
      return await this.roleRepository.save(role);
    } catch (error: any) {
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

  async update(id: number, updateRoleDto: UpdateRoleDto) {
    try {
      const rol = await this.findOne(id);
      if (rol.name === updateRoleDto.name)
        throw new BadRequestException('Los datos enviados son iguales a los registrados actualmente');
      const existRol = await this.roleRepository.exists({
        where: { name: updateRoleDto.name, roleId: Not(id) },
      });
      if (existRol) throw new ConflictException('El nombre del rol ya existe');

      Object.assign(rol, updateRoleDto);
      return this.roleRepository.save(rol);
      
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al actualizar el rol');
    }
  }

  async remove(id: number) {
    const rol = await this.findOne(id);
    this.roleRepository.remove(rol);
    return `el Rol ha sido elimado`;
  }
}
