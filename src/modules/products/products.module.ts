import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { CategoriesModule } from '../categories/categories.module';
import { ProductStatesModule } from '../product-states/product-states.module';
import { ProductStates } from '../product-states/entities/product-states.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductStates]),
    CategoriesModule,
    ProductStatesModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
