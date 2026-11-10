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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { IdValidationPipe } from '@/common/pipes/id-validation/id-validation.pipe';
import { paginationRoleDto } from '../roles/dto/pagination-role.dto';
import { toSupplierResponse } from './dto/supplier-response.dto';

@Controller('suppliers')
@UseGuards(RolesGuard)
@Roles('Admin')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  async create(@Body() createSupplierDto: CreateSupplierDto) {
    return toSupplierResponse(
      await this.suppliersService.create(createSupplierDto),
    );
  }
  @Get()
  async findAll(@Query() query: paginationRoleDto) {
    const { take, page } = query;
    const result = await this.suppliersService.findAll(take, page);
    return {
      suppliers: result.suppliers.map(toSupplierResponse),
      total: result.total,
      take: result.take,
      skip: result.skip,
      lastPage: result.lastPage,
    };
  }

  @Get(':id')
  async findOne(@Param('id', IdValidationPipe) id: string) {
    return toSupplierResponse(await this.suppliersService.findOne(+id));
  }

  @Patch('active/:id')
  active(@Param('id', IdValidationPipe) id: string) {
    return this.suppliersService.active(+id);
  }
  @Patch(':id')
  async update(
    @Param('id', IdValidationPipe) id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return toSupplierResponse(
      await this.suppliersService.update(+id, updateSupplierDto),
    );
  }

  @Delete(':id')
  remove(@Param('id', IdValidationPipe) id: string) {
    return this.suppliersService.remove(+id);
  }
}
