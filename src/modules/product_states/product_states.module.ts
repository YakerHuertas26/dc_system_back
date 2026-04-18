import { Module } from '@nestjs/common';
import { ProductStatesService } from './product_states.service';
import { ProductStatesController } from './product_states.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductStates } from './entities/product_states.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductStates])],
  controllers: [ProductStatesController],
  providers: [ProductStatesService],
})
export class ProductStatesModule {}
