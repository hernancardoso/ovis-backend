import { Test, TestingModule } from '@nestjs/testing';
import { CollarsService } from './collars.service';

describe('CollarsService', () => {
  let service: CollarsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CollarsService],
    }).compile();

    service = module.get<CollarsService>(CollarsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
