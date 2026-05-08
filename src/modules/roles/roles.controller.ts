import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { IdValidationPipe } from '@/common/pipes/id-validation/id-validation.pipe';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Post()
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Get(':id')
  findOne(@Param('id', IdValidationPipe) id: string) {
    return this.rolesService.findOne(+id);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Patch(':id')
  update(@Param('id', IdValidationPipe) id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(+id, updateRoleDto);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id')
  remove(@Param('id', IdValidationPipe) id: string) {
    return this.rolesService.remove(+id);
  }
}
