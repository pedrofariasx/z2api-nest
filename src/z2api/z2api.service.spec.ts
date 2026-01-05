import { Test, TestingModule } from '@nestjs/testing';
import { Z2apiService } from './z2api.service';

describe('Z2apiService', () => {
  let service: Z2apiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Z2apiService],
    }).compile();

    service = module.get<Z2apiService>(Z2apiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
