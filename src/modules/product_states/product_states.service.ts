import { Injectable } from '@nestjs/common';
import { CreateProductStateDto } from './dto/create-product_state.dto';
import { UpdateProductStateDto } from './dto/update-product_state.dto';

@Injectable()
export class ProductStatesService {
  create(createProductStateDto: CreateProductStateDto) {
    return 'This action adds a new productState';
  }

  findAll() {
    return `This action returns all productStates`;
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
