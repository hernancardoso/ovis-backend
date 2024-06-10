import { Test, TestingModule } from '@nestjs/testing';
import { CollarsController } from './collars.controller';
import { CollarsService } from './collars.service';

describe('CollarsController', () => {
  let controller: CollarsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollarsController],
      providers: [CollarsService],
    }).compile();

    controller = module.get<CollarsController>(CollarsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
