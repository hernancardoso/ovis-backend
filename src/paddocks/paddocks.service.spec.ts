import { Test, TestingModule } from '@nestjs/testing';
import { PaddocksService } from './paddocks.service';

describe('PaddocksService', () => {
  let service: PaddocksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaddocksService],
    }).compile();

    service = module.get<PaddocksService>(PaddocksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
