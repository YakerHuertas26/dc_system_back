import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Categories } from '../categories/entities/categories.entity';
import { ProductStates } from '../product_states/entities/product_states.entity';
import { CategoriesModule } from '../categories/categories.module';
import { ProductStatesModule } from '../product_states/product_states.module';

@Module({
  imports:[TypeOrmModule.forFeature([Product]),CategoriesModule,ProductStatesModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
