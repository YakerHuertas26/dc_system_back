import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductStateDto } from './dto/create-product_state.dto';
import { UpdateProductStateDto } from './dto/update-product_state.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductStates } from './entities/product_states.entity';
import { Not, Repository } from 'typeorm';

@Injectable()
export class ProductStatesService {
  constructor(
    @InjectRepository(ProductStates)
    private readonly productStateRepository: Repository<ProductStates>,
  ) {}

  async create(createProductStateDto: CreateProductStateDto) {
    try {
      const existeStateProduct = await this.productStateRepository.exists({
        where: {
          name: createProductStateDto.name,
        },
      });

      if (existeStateProduct) {
        throw new ConflictException('El estado del producto ya existe');
      }

      const stateProduct = this.productStateRepository.create(createProductStateDto);
      return await this.productStateRepository.save(stateProduct);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al crear el estado del porducto')
    }
  }

  async findAll() {
    return await this.productStateRepository.find();
  }

  async findOne(id: number) {
    try {
      const productState = await this.productStateRepository. findOneBy({productStateId: id});
      if (!productState) {
        throw new NotFoundException('El estado del producto no existe');
      }
      return productState;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al obtener el estado del producto');
    }
  }

  async update(id: number, updateProductStateDto: UpdateProductStateDto) {
    try {
      const productState = await this.findOne(id);

      if (updateProductStateDto.name === productState.name) throw new ConflictException('No se han realizado cambios en el estado del producto');

      const existeStateProduct = await this.productStateRepository.exists({
        where: {
          name: updateProductStateDto.name,
          productStateId: Not(id),
        },
      });
      if (existeStateProduct) {
        throw new ConflictException('El estado del producto ya existe');
      }
      productState.name = updateProductStateDto.name;
      return await this.productStateRepository.save(productState);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al actualizar el estado del producto');
    }
  }

  async remove(id: number) {
    const productState = await this.findOne(id);
    await this.productStateRepository.remove(productState);
    return { message: 'El estado del producto ha sido eliminado' };
  }
}
