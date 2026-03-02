import { ConflictException, Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Repository } from 'typeorm';


@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
      private readonly categoryRepository: Repository <Category>
  ){}

  // create a new category 
  async create(createCategoryDto: CreateCategoryDto)  {
    try {
      // verificar si el nombre existe
        const existName= await  this.categoryRepository.exists({
          where:{name: createCategoryDto.name}
        })

        if (existName) {
          throw new ConflictException('El nombre de la categoría ya existe');
        }

      // verificar si el código existe
        const existCode = await this.categoryRepository.exists({
          where:{code: createCategoryDto.code}
        });

        if (existCode) {
          throw new ConflictException('El código ya existe')
        }


    } catch (error) {
      
    }
  }

  findAll() {
    return `This action returns all categories`;
  }

  findOne(id: number) {
    return `This action returns a #${id} category`;
  }

  update(id: number, updateCategoryDto: UpdateCategoryDto) {
    return `This action updates a #${id} category`;
  }

  remove(id: number) {
    return `This action removes a #${id} category`;
  }
}
