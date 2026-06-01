import { Module } from '@nestjs/common';
import { ProductStatesService } from './product-states.service';
import { ProductStatesController } from './product-states.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductStates } from './entities/product-states.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductStates])],
  controllers: [ProductStatesController],
  providers: [ProductStatesService],
  exports: [ProductStatesService],
})
export class ProductStatesModule {}
