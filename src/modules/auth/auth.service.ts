import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LoginAuthDto } from './dto/login-auth.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
        private readonly roleService: RolesService,
    ){}

    async login(loginAuthDto: LoginAuthDto){
        const user=await this.userRepository.exists({where:{name:loginAuthDto.name}});
        if (!user) throw new NotFoundException('User no existe')
        console.log(!user);
    }
}
