import { ConflictException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindManyOptions, FindOptionsWhere, Like, Not, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Categories } from '../categories/entities/categories.entity';
import { ProductStates } from '../product_states/entities/product_states.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(Categories) private readonly categoryRepository: Repository<Categories>,
    @InjectRepository(ProductStates) private readonly productStatesRepository: Repository<ProductStates>,
  ){}
  
  async create(createProductDto: CreateProductDto) {
    try {
    const category= await this.categoryRepository.findOneBy({categoryId: createProductDto.categoryId})
    if (!category) throw new NotFoundException("La categoría no existe");

    const productState= await this.productStatesRepository.findOneBy({productStateId: createProductDto.productStateId})
    if (!productState) throw new NotFoundException("El estado del producto no existe");

    const productName= await this.productRepository.exists({where:{name:createProductDto.name}})
    if (productName) throw new ConflictException("El nombre del producto ya existe");

    const product= this.productRepository.create({...createProductDto, category, productState});
    const productSaved= await this.productRepository.save(product);

    productSaved.code= category.code + productSaved.productId.toString().padStart(4,'0');
    return await this.productRepository.save(productSaved);

    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al crear el producto')
    }
  }

  async findAll(categoryId?:number, productStateId?:number, search?: string) {
    const clearSearch= search?.trim();
    
    const baseFilter= {
      ...(categoryId!==undefined && {categoryId}),
      ...(productStateId!==undefined && {productStateId})
    }

    let where: FindOptionsWhere<Product> | FindOptionsWhere<Product>[];

    if (clearSearch) {
      where = [
        {...baseFilter, name:  Like(`%${clearSearch}%`)},
        {...baseFilter, code: Like(`%${clearSearch}%`)}
      ]
    }else{
      where= baseFilter
    }
    const options: FindManyOptions<Product>= {
      relations: {
        category: true,
        productState: true
      },
      where,
      order:{productId: 'DESC'},
    }

    if (categoryId!==undefined) {
      const existsCategory= await this.categoryRepository.exists({where:{categoryId}})
      if (!existsCategory) {
        throw new NotFoundException("La categoría no existe");
      }
    }

    if (productStateId !==undefined) {
        const existsProductState= await this.productStatesRepository.exists({where:{productStateId}})
        if (!existsProductState) {
          throw new NotFoundException("El estado del producto no existe");
      }
    }

    const [products, total] = await this.productRepository.findAndCount(options);
    return { products, total };
  }

  findOne(id: number) {
    return `This action returns a #${id} product`;
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return `This action updates a #${id} product`;
  }

  remove(id: number) {
    return `This action removes a #${id} product`;
  }
}
