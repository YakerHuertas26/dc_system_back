import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatesController } from './product_states.controller';
import { ProductStatesService } from './product_states.service';

describe('ProductStatesController', () => {
  let controller: ProductStatesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductStatesController],
      providers: [ProductStatesService],
    }).compile();

    controller = module.get<ProductStatesController>(ProductStatesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
