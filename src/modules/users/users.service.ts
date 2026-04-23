import { ConflictException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) 
      private readonly userRepository: Repository<User>,
      private readonly roleService: RolesService,
  ){}


  async create(createUserDto: CreateUserDto) {
    try {
      const role= await this.roleService.findOne(createUserDto.roleId);
      const existEmail= await this.userRepository.exists({where: {email: createUserDto.email}});
      if (existEmail) {
        throw new ConflictException('El correo electrónico ya está registrado');
      }
      const user= this.userRepository.create({...createUserDto,role})
      const saveUser= await this.userRepository.save(user);
      const {password, ...result}= saveUser
      return result

    } catch (error:any) {
      if(error instanceof HttpException) throw error;
      if(error?.code=== 'ER_DUP_ENTRY') throw new ConflictException('El correo electrónico ya está registrado');
      throw new InternalServerErrorException('Error al crear usuario');
    }
    
  }

  async findAll() {
    return await this.userRepository.find({
      relations:{
        role:true
      }
    })
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
