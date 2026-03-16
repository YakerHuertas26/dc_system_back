import { ConflictException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categories } from './entities/categories.entity';


@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Categories)
      private readonly categoryRepository: Repository <Categories>
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

      // // verificar si el código existe
      //   const existCode = await this.categoryRepository.exists({
      //     where:{code: createCategoryDto.code}
      //   });

      //   if (existCode) {
      //     throw new ConflictException('El código ya existe')
      //   }

        // creación de la categoría 
        const category = this.categoryRepository.create(createCategoryDto);
        const saveCategory= await this.categoryRepository.save(category);
        
        // modifico el código de cada categoría
        saveCategory.code = saveCategory.category_id.toString().padStart(4, '0');
        return await this.categoryRepository.save(category);
        

    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;    
      }
      throw new InternalServerErrorException('Error al crear categoría');
    }
  }

  // listar todas las categorias por estado 
  async findAll(state?: boolean) {
    try {
      if (state !== undefined) {
        return await this.categoryRepository.find({where: {state}})       
      }
      
      return await this.categoryRepository.find({order:{state: 'DESC'}});
    } catch (error) {
      throw new InternalServerErrorException('Error al obtener categorías');
    }
  }

  async findOne(id: number) {
    try {
      const categoryID= await this.categoryRepository.findOneBy({
        category_id: id
      });

      if (!categoryID) {
        throw new NotFoundException('El ID no existe')
      };
      
      return categoryID;
      
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new InternalServerErrorException('Error al obtener categoría');
    }
  }

  update(id: number, updateCategoryDto: UpdateCategoryDto) {
    return `This action updates a #${id} category`;
  }

  remove(id: number) {
    return `This action removes a #${id} category`;
  }
}
