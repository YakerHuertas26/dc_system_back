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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { IdValidationPipe } from '@/common/pipes/id-validation/id-validation.pipe';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { paginationRoleDto } from './dto/pagination-role.dto';
import type { AuthenticatedRequest } from '../auth/authorization.policy';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Post()
  create(
    @Body() createRoleDto: CreateRoleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.rolesService.create(createRoleDto, request.user?.userId);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Get()
  findAll(@Query() query:paginationRoleDto) {
    const {take, page} = query
    return this.rolesService.findAll(take, page );
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
  update(
    @Param('id', IdValidationPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.rolesService.update(+id, updateRoleDto, request.user?.userId);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id')
  remove(
    @Param('id', IdValidationPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.rolesService.remove(+id, request.user?.userId);
  }
}
