import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateProductStateDto } from './dto/create-product_state.dto';
import { UpdateProductStateDto } from './dto/update-product_state.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductStates } from './entities/product_states.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ProductStatesService {
  constructor(
    @InjectRepository(ProductStates)
    private readonly productStateRepository: Repository<ProductStates>
  ){}

  async create(createProductStateDto: CreateProductStateDto) {
    try {
      const existeStateProduct= await this.productStateRepository.exists({
        where:{name: createProductStateDto.name}
      })

      if(existeStateProduct) {throw new ConflictException('El estado del producto ya existe');
      }
      const stateProduct = this.productStateRepository.create(createProductStateDto);
      return await this.productStateRepository.save(stateProduct);
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Error al crear el estado del porducto')
    }
  }

  async findAll() {
    return this.productStateRepository.find();
  }

  findOne(id: number) {
    return `This action returns a #${id} productState`;
  }

  update(id: number, updateProductStateDto: UpdateProductStateDto) {
    return `This action updates a #${id} productState`;
  }

  remove(id: number) {
    return `This action removes a #${id} productState`;
  }
}
