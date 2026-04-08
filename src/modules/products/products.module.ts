import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Categories } from '../categories/entities/categories.entity';
import { ProductStates } from '../product_states/entities/product_states.entity';

@Module({
  imports:[TypeOrmModule.forFeature([Product,Categories,ProductStates])],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
