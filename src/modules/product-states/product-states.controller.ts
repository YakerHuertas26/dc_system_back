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
import { ProductStatesService } from './product-states.service';
import { CreateProductStateDto } from './dto/create-product_state.dto';
import { UpdateProductStateDto } from './dto/update-product_state.dto';
import { IdValidationPipe } from '@/common/pipes/id-validation/id-validation.pipe';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationProductStateDto } from './dto/pagination-product_state.dto';
import { toProductStateResponse } from './dto/product-state-response.dto';

@Controller('product-states')
export class ProductStatesController {
  constructor(private readonly productStatesService: ProductStatesService) {}

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Post()
  async create(@Body() createProductStateDto: CreateProductStateDto) {
    return toProductStateResponse(
      await this.productStatesService.create(createProductStateDto),
    );
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Get()
  async findAll(@Query() query: PaginationProductStateDto) {
    const { take, page } = query;
    const result = await this.productStatesService.findAll(take, page);
    return {
      stateProducts: result.stateProducts.map(toProductStateResponse),
      total: result.total,
      take: result.take,
      skip: result.skip,
      lastPage: result.lastPage,
    };
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Get(':id')
  async findOne(@Param('id', IdValidationPipe) id: string) {
    return toProductStateResponse(await this.productStatesService.findOne(+id));
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Patch(':id')
  async update(
    @Param('id', IdValidationPipe) id: string,
    @Body() updateProductStateDto: UpdateProductStateDto,
  ) {
    return toProductStateResponse(
      await this.productStatesService.update(+id, updateProductStateDto),
    );
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id')
  remove(@Param('id', IdValidationPipe) id: string) {
    return this.productStatesService.remove(+id);
  }
}
