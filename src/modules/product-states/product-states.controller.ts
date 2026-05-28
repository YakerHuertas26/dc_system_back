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

@Controller('product-states')
export class ProductStatesController {
  constructor(private readonly productStatesService: ProductStatesService) {}

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Post()
  create(@Body() createProductStateDto: CreateProductStateDto) {
    return this.productStatesService.create(createProductStateDto);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Get()
  findAll(@Query() query: PaginationProductStateDto) {
    const {take, page} = query
    return this.productStatesService.findAll(take, page);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Get(':id')
  findOne(@Param('id', IdValidationPipe) id: string) {
    return this.productStatesService.findOne(+id);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Patch(':id')
  update(
    @Param('id', IdValidationPipe) id: string,
    @Body() updateProductStateDto: UpdateProductStateDto,
  ) {
    return this.productStatesService.update(+id, updateProductStateDto);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id')
  remove(@Param('id', IdValidationPipe) id: string) {
    return this.productStatesService.remove(+id);
  }
}
