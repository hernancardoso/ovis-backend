import { Test, TestingModule } from '@nestjs/testing';
import { SheepCollarService } from './sheep-collar.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SheepCollarEntity } from './entities/sheep-collar.entity';
import { CollarsService } from 'src/collars/collars.service';
import { SheepService } from 'src/sheep/sheep.service';
import { AssignCollarToSheepDto } from './dto/assign-collar-to-sheep.dto';
import { UnassignCollarToSheepDto } from './dto/unassign-collar-to-sheep.dto copy';
import { NotFoundException } from '@nestjs/common';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';

describe('SheepCollarService', () => {
  let service: SheepCollarService;
  let sheepCollarRepository: Repository<SheepCollarEntity>;
  let collarsService: CollarsService;
  let sheepService: SheepService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SheepCollarService,
        {
          provide: getRepositoryToken(SheepCollarEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: CollarsService,
          useValue: {
            findByIdOrFail: jest.fn(),
          },
        },
        {
          provide: SheepService,
          useValue: {
            findByIdOrFail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SheepCollarService>(SheepCollarService);

    sheepCollarRepository = module.get<Repository<SheepCollarEntity>>(getRepositoryToken(SheepCollarEntity));
    collarsService = module.get<CollarsService>(CollarsService);
    sheepService = module.get<SheepService>(SheepService);
  });

  describe('assign', () => {
    const establishmentMock: EstablishmentEntity = {
      id: '1',
      name: 'Establishment 1',
      collars: [],
      sheeps: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const collarMock: CollarEntity = {
      id: '1',
      name: 'Collar 1',
      sheep: [],
      establishment: establishmentMock,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const sheepMock: SheepEntity = {
      id: '1',
      name: 'Collar 1',
      collars: [],
      establishment: establishmentMock,
    };

    it('should assign a collar to a sheep', async () => {
      const assignCollarToSheepDto: AssignCollarToSheepDto = { collarId: '1', sheepId: '1', assignedFrom: new Date() };

      jest.spyOn(service, 'findActiveAssociationsOf').mockResolvedValue({ collar: undefined, sheep: undefined });

      jest.spyOn(collarsService, 'findByIdOrFail').mockResolvedValue(collarMock);
      jest.spyOn(sheepService, 'findByIdOrFail').mockResolvedValue(sheepMock);
      jest.spyOn(sheepCollarRepository, 'create').mockReturnValue(assignCollarToSheepDto as any);
      jest.spyOn(sheepCollarRepository, 'save').mockResolvedValue(assignCollarToSheepDto as any);

      const result = await service.assign(assignCollarToSheepDto);
      expect(result).toEqual(assignCollarToSheepDto);
    });

    it('should throw an error if collar is already in use', async () => {
      const assignCollarToSheepDto: AssignCollarToSheepDto = { collarId: '1', sheepId: '1' };
      jest.spyOn(service, 'findActiveAssociationsOf').mockResolvedValue({ collar: collarMock, sheep: undefined });

      await expect(service.assign(assignCollarToSheepDto)).rejects.toThrow('The collar 1 - (Collar 1) is already in use');
    });

    it('should throw an error if sheep is already in use', async () => {
      const assignCollarToSheepDto: AssignCollarToSheepDto = { collarId: '1', sheepId: '1' };
      jest.spyOn(service, 'findActiveAssociationsOf').mockResolvedValue({ collar: undefined, sheep: sheepMock });

      await expect(service.assign(assignCollarToSheepDto)).rejects.toThrow('The collar 1 - (Sheep 1) is already in use');
    });

    it('should throw an error if collar and sheep are not in the same establishment', async () => {
      const assignCollarToSheepDto: AssignCollarToSheepDto = { collarId: '1', sheepId: '1' };
      const establishmentMock2 = Object.assign(establishmentMock);
      establishmentMock2.id = '2';
      establishmentMock2.name = 'Establishment 2';

      const sheepMock2 = Object.assign(sheepMock);
      sheepMock2.establishment = establishmentMock2;

      jest.spyOn(service, 'findActiveAssociationsOf').mockResolvedValue({ collar: undefined, sheep: undefined });
      jest.spyOn(collarsService, 'findByIdOrFail').mockResolvedValue(collarMock);
      jest.spyOn(sheepService, 'findByIdOrFail').mockResolvedValue(sheepMock2);

      await expect(service.assign(assignCollarToSheepDto)).rejects.toThrowError(
        'Collar and sheep are not in the same establishment'
      );
    });
  });

  describe('unassign', () => {
    it('should unassign a collar from a sheep', async () => {
      const unassignCollarToSheepDto: UnassignCollarToSheepDto = { sheepId: '1', collarId: '1' };

      const association = { id: '1', sheepId: '1', collarId: '1', assignedUntil: null };
      jest.spyOn(sheepCollarRepository, 'findOne').mockResolvedValue(association as any);
      jest.spyOn(sheepCollarRepository, 'save').mockResolvedValue({ ...association, assignedUntil: new Date() } as any);

      const result = await service.unassign(unassignCollarToSheepDto);
      expect(result.assignedUntil).toBeInstanceOf(Date);
    });

    it('should throw a NotFoundException if association is not found', async () => {
      const unassignCollarToSheepDto: UnassignCollarToSheepDto = { sheepId: '1', collarId: '1' };
      jest.spyOn(sheepCollarRepository, 'findOne').mockResolvedValue(null);

      await expect(service.unassign(unassignCollarToSheepDto)).rejects.toThrow(NotFoundException);
    });
  });
});
