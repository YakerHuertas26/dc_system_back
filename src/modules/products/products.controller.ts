import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { IdValidationPipe } from '@/common/pipes/id-validation/id-validation.pipe';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  toAdminProductResponse,
  toPublicProductResponse,
} from './dto/product-response.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Post()
  async create(@Body() createProductDto: CreateProductDto) {
    return toAdminProductResponse(
      await this.productsService.create(createProductDto),
    );
  }

  @Public()
  @Get()
  async findAll(@Query() query: FilterProductDto) {
    const { category_id, product_state, search, take, page } = query;
    const result = await this.productsService.findAll(
      category_id,
      product_state,
      search,
      take,
      page,
    );
    return {
      products: result.products.map(toPublicProductResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
      lastPage: result.lastPage,
    };
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id', IdValidationPipe) id: string) {
    return toPublicProductResponse(await this.productsService.findOne(+id));
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Patch(':id')
  async update(
    @Param('id', IdValidationPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return toAdminProductResponse(
      await this.productsService.update(+id, updateProductDto),
    );
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id')
  async remove(@Param('id', IdValidationPipe) id: string) {
    return toAdminProductResponse(await this.productsService.remove(+id));
  }
}
