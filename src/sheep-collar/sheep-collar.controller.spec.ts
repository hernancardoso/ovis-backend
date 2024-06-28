import { Test, TestingModule } from '@nestjs/testing';
import { SheepCollarController } from './sheep-collar.controller';
import { SheepCollarService } from './sheep-collar.service';

describe('SheepCollarController', () => {
  let controller: SheepCollarController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SheepCollarController],
      providers: [SheepCollarService],
    }).compile();

    controller = module.get<SheepCollarController>(SheepCollarController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
