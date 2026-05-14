import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Public } from '../auth/decorators/public.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { IdValidationPipe } from '@/common/pipes/id-validation/id-validation.pipe';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  // @Public()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Post()
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }
  @Public()
  @Get()
  findAll() {
    return this.suppliersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id',IdValidationPipe) id: string) {
    return this.suppliersService.findOne(+id);
  }

  @Patch('active/:id')
  active(@Param('id',IdValidationPipe) id: string, @Body() updateSupplierDto: UpdateSupplierDto) {
    return this.suppliersService.active(+id);
  }
  @Patch(':id')
  update(@Param('id',IdValidationPipe) id: string, @Body() updateSupplierDto: UpdateSupplierDto) {
    return this.suppliersService.update(+id, updateSupplierDto);
  }

  @Delete(':id')
  remove(@Param('id',IdValidationPipe) id: string) {
    return this.suppliersService.remove(+id);
  }
}
