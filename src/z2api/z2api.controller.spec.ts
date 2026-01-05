import { Test, TestingModule } from '@nestjs/testing';
import { Z2apiController } from './z2api.controller';

describe('Z2apiController', () => {
  let controller: Z2apiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Z2apiController],
    }).compile();

    controller = module.get<Z2apiController>(Z2apiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
