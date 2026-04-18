import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProductStatesService } from './product_states.service';
import { CreateProductStateDto } from './dto/create-product_state.dto';
import { UpdateProductStateDto } from './dto/update-product_state.dto';
import { IdValidationPipe } from '@/common/pipes/id-validation/id-validation.pipe';

@Controller('product-states')
export class ProductStatesController {
  constructor(private readonly productStatesService: ProductStatesService) {}

  @Post()
  create(@Body() createProductStateDto: CreateProductStateDto) {
    return this.productStatesService.create(createProductStateDto);
  }

  @Get()
  findAll() {
    return this.productStatesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id',IdValidationPipe) id: string) {
    return this.productStatesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id',IdValidationPipe) id: string, @Body() updateProductStateDto: UpdateProductStateDto) {
    return this.productStatesService.update(+id, updateProductStateDto);
  }

  @Delete(':id')
  remove(@Param('id',IdValidationPipe) id: string) {
    return this.productStatesService.remove(+id);
  }
}
