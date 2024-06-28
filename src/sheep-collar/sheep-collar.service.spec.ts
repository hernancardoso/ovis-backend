import { Test, TestingModule } from '@nestjs/testing';
import { SheepCollarService } from './sheep-collar.service';

describe('SheepCollarService', () => {
  let service: SheepCollarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SheepCollarService],
    }).compile();

    service = module.get<SheepCollarService>(SheepCollarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
