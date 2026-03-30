import { Module } from '@nestjs/common';
import { ProductStatesService } from './product_states.service';
import { ProductStatesController } from './product_states.controller';

@Module({
  controllers: [ProductStatesController],
  providers: [ProductStatesService],
})
export class ProductStatesModule {}
