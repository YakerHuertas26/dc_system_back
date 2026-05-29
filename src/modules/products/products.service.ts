import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { 
  FindManyOptions,
  FindOptionsWhere, Like, Not, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoriesService } from '../categories/categories.service';
import { ProductStatesService } from '../product-states/product-states.service';
import { isEqueals } from '@/common/utils/compare';


@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly categoryService: CategoriesService,
    private readonly productStatesService: ProductStatesService,
  ) {}

  async create(createProductDto: CreateProductDto) {
    try {
      const category = await this.categoryService.findOne(
        createProductDto.categoryId,
      );
      const productState = await this.productStatesService.findOne(
        createProductDto.productStateId,
      );
      const productName = await this.productRepository.exists({
        where: { name: createProductDto.name },
      });
      if (productName)
        throw new ConflictException('El nombre del producto ya existe');

      const product = this.productRepository.create({
        ...createProductDto,
        category,
        productState,
      });
      const productSaved = await this.productRepository.save(product);

      productSaved.code = category.code + productSaved.productId.toString().padStart(4,'0');
      await this.productRepository.update(productSaved.productId, {
        code: productSaved.code,
      });

      return productSaved;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('El nombre del producto ya existe');
      }
      throw new InternalServerErrorException('Error al crear el producto');
    }
  }

  async findAll(
    categoryId?: number,
    productStateId?: number,
    search?: string,
    limit: number = 10,
    page: number = 1,
  ) {
    try {
      const clearSearch = search?.trim();
      const take = limit ;
      const skip = (page - 1) * take;

      const baseFilter = {
        ...(categoryId !== undefined && { categoryId }),
        ...(productStateId !== undefined && { productStateId }),
      };

      let where: FindOptionsWhere<Product> | FindOptionsWhere<Product>[];

      if (clearSearch) {
        where = [
          { ...baseFilter, name: Like(`%${clearSearch}%`) },
          { ...baseFilter, code: Like(`%${clearSearch}%`) },
        ];
      } else {
        where = baseFilter;
      }
      const options: FindManyOptions<Product> = {
        relations: {
          category: true,
          productState: true,
        },
        where,
        order: { productId: 'DESC' },
        take,
        skip,
      };

      if (categoryId !== undefined) {
        await this.categoryService.findOne(categoryId);
      }

      if (productStateId !== undefined) {
        await this.productStatesService.findOne(productStateId);
      }

      const [products, total] = await this.productRepository.findAndCount(options);
      return {
        products,
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al obtener los productos');
    }
  }

  async findOne(id: number) {
    try {
      const product = await this.productRepository.findOne({
        where: { productId: id },
        relations: {
          category: true,
          productState: true,
        },
      });

      if (!product) {
        throw new NotFoundException('El producto no existe');
      }

      return product;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al obtener el producto');
    }
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    try {
      const product = await this.findOne(id);
      const isEquals = isEqueals(product, updateProductDto);
      if(isEquals) throw new BadRequestException('No se registraron cambios')
      if (updateProductDto.name) {
        const existName = await this.productRepository.exists({
          where: {
            name: updateProductDto.name,
            productId: Not(id),
          },
        });
        if (existName) {
          throw new ConflictException('El nombre del producto ya existe');
        }
      }
      if (updateProductDto.categoryId) {
        const category = await this.categoryService.findOne(
          updateProductDto.categoryId,
        );

        product.category = category;
        product.code =
          category.code + product.productId.toString().padStart(4, '0');
      }

      if (updateProductDto.productStateId) {
        const productState = await this.productStatesService.findOne(
          updateProductDto.productStateId,
        );
        product.productState = productState;
      }

      Object.assign(product, updateProductDto);

      return await this.productRepository.save(product);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al actualizar el producto');
    }
  }

  async remove(id: number) {
    const product = await this.findOne(id);
    const inactiveState = await this.productStatesService.findOne(6);
    if (!inactiveState) {
      throw new NotFoundException(
        'El estado inactivo no existe, no se puede eliminar el producto'
      );
    }
    product.productState = inactiveState;
    return this.productRepository.save(product);
  }
}
