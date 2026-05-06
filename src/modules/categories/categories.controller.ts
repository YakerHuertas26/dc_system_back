import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { StateValidationPipe } from '@/common/pipes/state-validation/state-validation.pipe';
import { IdValidationPipe } from '@/common/pipes/id-validation/id-validation.pipe';


@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }
  
  @Get()
  findAll(@Query('state', StateValidationPipe) state?: boolean) {
    return this.categoriesService.findAll(state);
  }

  @Get(':id')
  findOne(@Param('id', IdValidationPipe) id: string) {
    return this.categoriesService.findOne(+id);
  }

  @Patch('active/:id')
  active(@Param('id', IdValidationPipe) id: string) {
    return this.categoriesService.active(+id);
  }

  @Patch(':id')
  update(
    @Param('id', IdValidationPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(+id, updateCategoryDto);
  }

  @Delete(':id')
  remove(@Param('id', IdValidationPipe) id: string) {
    return this.categoriesService.remove(+id);
  }
}
