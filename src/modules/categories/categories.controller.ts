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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { StateValidationPipe } from '@/common/pipes/state-validation/state-validation.pipe';
import { IdValidationPipe } from '@/common/pipes/id-validation/id-validation.pipe';
import { Public } from '../auth/decorators/public.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationCategoryDto } from './dto/pagination-categoey.dto';
import { toCategoryResponse } from './dto/category-response.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Post()
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return toCategoryResponse(
      await this.categoriesService.create(createCategoryDto),
    );
  }

  @Public()
  @Get()
  async findAll(@Query() query?: PaginationCategoryDto) {
    const { state, take, page } = query || {};
    const result = await this.categoriesService.findAll(state, take, page);
    return {
      categories: result.categories.map(toCategoryResponse),
      total: result.total,
      take: result.take,
      skip: result.skip,
      lastPage: result.lastPage,
    };
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id', IdValidationPipe) id: string) {
    return toCategoryResponse(await this.categoriesService.findOne(+id));
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Patch('active/:id')
  async active(@Param('id', IdValidationPipe) id: string) {
    return toCategoryResponse(await this.categoriesService.active(+id));
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Patch(':id')
  async update(
    @Param('id', IdValidationPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return toCategoryResponse(
      await this.categoriesService.update(+id, updateCategoryDto),
    );
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id')
  async remove(@Param('id', IdValidationPipe) id: string) {
    return toCategoryResponse(await this.categoriesService.remove(+id));
  }
}
