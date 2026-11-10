import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { IdValidationPipe } from '@/common/pipes/id-validation/id-validation.pipe';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { paginationRoleDto } from '../roles/dto/pagination-role.dto';
import type { AuthenticatedRequest } from '../auth/authorization.policy';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Post()
  create(
    @Body() createUserDto: CreateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.create(createUserDto, request.user?.userId);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Get()
  findAll(@Query() query: paginationRoleDto) {
    const {take, page} = query
    return this.usersService.findAll(take, page);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Get(':id')
  findOne(@Param('id', IdValidationPipe) id: string) {
    return this.usersService.findOne(+id);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Patch(':id')
  update(
    @Param('id', IdValidationPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.update(+id, updateUserDto, request.user?.userId);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id')
  remove(
    @Param('id', IdValidationPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.remove(+id, request.user?.userId);
  }
}
