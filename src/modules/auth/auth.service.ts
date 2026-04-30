import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    ) { }

    async login(loginAuthDto: LoginAuthDto) {
        const user = await this.userRepository.findOne({
            where: { name: loginAuthDto.name },
            select: ['userId', 'name', 'password', 'email', 'roleId', 'state'],
            relations: { role: true }
        });
        if (!user) throw new UnauthorizedException('Usuario no registrado');
        if (!user.state) throw new UnauthorizedException('El usuario no se encuentra activo');

        const passwordValid = await user.comparePassword(loginAuthDto.password);
        if (!passwordValid) throw new UnauthorizedException('Constraseña incorrecta');

        const payload = {
            sub: user.userId,
            name: user.name,
            roleName: user.role.name,
            roleId: user.roleId
        }

        const accessToken = this.jwtService.sign(payload);
        const { password, ...userAutorised } = user
        return { userAutorised, accessToken }
    }

    // va servir para validar en la estrategia 
    async validateUser(userId: number) {
        const user = await this.userRepository.findOne({
            where: { userId: userId },
            relations: {
                role: true
            }
        });
        if (!user) {
            throw new UnauthorizedException('Usuario no encontrado');
        }

        if (!user.state) {
            throw new UnauthorizedException('Usuario desactivado');
        }

        return user;
    }
}
