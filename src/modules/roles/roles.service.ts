import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Repository } from 'typeorm';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepository:Repository<Role>
  ){}

  async create(createRoleDto: CreateRoleDto) {
    try {
      const role= this.roleRepository.create(createRoleDto);
      return await this.roleRepository.save(role)
    } catch (error:any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('El rol ya existe')
      }
      throw new InternalServerErrorException('Error al crear un rol')
    }
  }

  findAll() {
    return `This action returns all roles`;
  }

  findOne(id: number) {
    return `This action returns a #${id} role`;
  }

  update(id: number, updateRoleDto: UpdateRoleDto) {
    return `This action updates a #${id} role`;
  }

  remove(id: number) {
    return `This action removes a #${id} role`;
  }
}
