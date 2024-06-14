import { Test, TestingModule } from '@nestjs/testing';
import { SheepService } from './sheep.service';

describe('SheepService', () => {
  let service: SheepService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SheepService],
    }).compile();

    service = module.get<SheepService>(SheepService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
