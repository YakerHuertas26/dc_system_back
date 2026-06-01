import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProductColorsService } from './product-colors.service';
import { CreateProductColorDto } from './dto/create-product-color.dto';
import { UpdateProductColorDto } from './dto/update-product-color.dto';

@Controller('product-colors')
export class ProductColorsController {
  constructor(private readonly productColorsService: ProductColorsService) {}

  @Post()
  create(@Body() createProductColorDto: CreateProductColorDto) {
    return this.productColorsService.create(createProductColorDto);
  }

  @Get()
  findAll() {
    return this.productColorsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productColorsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductColorDto: UpdateProductColorDto) {
    return this.productColorsService.update(+id, updateProductColorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productColorsService.remove(+id);
  }
}
