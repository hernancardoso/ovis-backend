import { Test, TestingModule } from '@nestjs/testing';
import { PaddocksController } from './paddocks.controller';
import { PaddocksService } from './paddocks.service';

describe('PaddocksController', () => {
  let controller: PaddocksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaddocksController],
      providers: [PaddocksService],
    }).compile();

    controller = module.get<PaddocksController>(PaddocksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
