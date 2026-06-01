import { Module } from '@nestjs/common';
import { ProductColorsService } from './product-colors.service';
import { ProductColorsController } from './product-colors.controller';

@Module({
  controllers: [ProductColorsController],
  providers: [ProductColorsService],
})
export class ProductColorsModule {}
