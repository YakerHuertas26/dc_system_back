import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
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
      
        // creación de la categoría 
        const category = this.categoryRepository.create(createCategoryDto);
        const saveCategory= await this.categoryRepository.save(category);
        
        // modifico el código de cada categoría
        saveCategory.code = saveCategory.categoryId.toString().padStart(4, '0');
        return await this.categoryRepository.save(saveCategory);
        

    } catch (error:any) {
      if (error instanceof HttpException) throw error;
      if (error?.code === 'ER_DUP_ENTRY') {
      throw new ConflictException('El nombre del producto ya existe');
    }
      throw new InternalServerErrorException('Error al crear categorías');
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
        categoryId: id
      });

      if (!categoryID) {
        throw new NotFoundException('La categoría no existe')
      };
      
      return categoryID;
      
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new InternalServerErrorException('Error al obtener categoría');
    }
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    try {
      const category= await this.findOne(id);
      if (!category.state) throw new ConflictException('No se puede actualizar una categoría inactiva');

      if (updateCategoryDto.name === category.name) throw new BadRequestException('No hay cambios para actualizar');

      const existName= await this.categoryRepository.exists({
        where:{name:updateCategoryDto.name, categoryId: Not(id)}
      })
        
        if (existName) throw new ConflictException('El nombre de la categoría ya existe');
        
      category.name= updateCategoryDto.name;
      return await this.categoryRepository.save(category);

    } catch (error) {
      if (error instanceof HttpException) throw error; 
      throw new InternalServerErrorException('Error al actualizar categoría')
    }  
  }

  async active(id:number) {
    const category= await this.findOne(id);
    category.state= true;
    return await this.categoryRepository.save(category); 
  }

  async remove(id: number) {
    const category= await this.findOne(id);
    category.state= false;
    return await this.categoryRepository.save(category);
  }
}
