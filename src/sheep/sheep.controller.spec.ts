import { Test, TestingModule } from '@nestjs/testing';
import { SheepController } from './sheep.controller';
import { SheepService } from './sheep.service';

describe('SheepController', () => {
  let controller: SheepController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SheepController],
      providers: [SheepService],
    }).compile();

    controller = module.get<SheepController>(SheepController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
