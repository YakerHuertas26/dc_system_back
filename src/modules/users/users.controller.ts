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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { IdValidationPipe } from '@/common/pipes/id-validation/id-validation.pipe';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { paginationRoleDto } from '../roles/dto/pagination-role.dto';
<<<<<<< HEAD
import { Public } from '../auth/decorators/public.decorator';
=======
>>>>>>> 60ab33b6269f7ffc9e31101b47aa6920eb4c3306

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Public()
  // @UseGuards(RolesGuard)
  // @Roles('Admin')
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
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
  ) {
    return this.usersService.update(+id, updateUserDto);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id')
  remove(@Param('id', IdValidationPipe) id: string) {
    return this.usersService.remove(+id);
  }
}
