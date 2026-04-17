import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { IdValidationPipe } from '@/common/pipes/id-validation/id-validation.pipe';


@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll(@Query() query:FilterProductDto ) {
    const {category_id, product_state, search, take,page} = query
    return this.productsService.findAll(category_id, product_state, search, take, page);
  }

  @Get(':id')
  findOne(@Param('id', IdValidationPipe) id: string) {
    return this.productsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id', IdValidationPipe) id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(+id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id', IdValidationPipe) id: string) {
    return this.productsService.remove(+id);
  }
}
