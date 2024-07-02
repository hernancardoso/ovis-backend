import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateSheepCollarDto } from './dto/create-sheep-collar.dto';
import { UpdateSheepCollarDto } from './dto/update-sheep-collar.dto';
import { SheepCollarEntity } from './entities/sheep-collar.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { EstablishmentsService } from 'src/establishments/establishments.service';
import { Repository, Not, IsNull } from 'typeorm';
import { CollarDto } from 'src/collars/dto/collar.dto';
import { AssignCollarToSheepDto } from './dto/assign-collar-to-sheep.dto';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { UnassignCollarToSheepDto } from './dto/unassign-collar-to-sheep.dto copy';
import { SheepService } from 'src/sheep/sheep.service';
import { CollarsService } from 'src/collars/collars.service';
import { PaddocksService } from 'src/paddocks/paddocks.service';

@Injectable()
export class SheepCollarService {
  constructor(
    @InjectRepository(SheepCollarEntity)
    private sheepCollarRepository: Repository<SheepCollarEntity>,
    private collarService: CollarsService,
    private sheepService: SheepService,
    private paddocksService: PaddocksService
  ) {}

  async findActiveAssociationsOf(collarId: string, sheepId: string) {
    const associations = await this.sheepCollarRepository.find({
      relations: ['collar', 'sheep'],
      take: 2,
      where: [
        { collar: { id: collarId }, assignedUntil: IsNull() },
        { sheep: { id: sheepId }, assignedUntil: IsNull() },
      ],
      order: { id: 'DESC' },
    });

    return {
      collar: associations.find((a) => a.collar.id === collarId)?.collar,
      sheep: associations.find((a) => a.sheep.id === sheepId)?.sheep,
    };
  }

  async assign(assignCollarToSheepDto: AssignCollarToSheepDto) {
    const { collarId, sheepId } = assignCollarToSheepDto;
    const assignedFrom = assignCollarToSheepDto.assignedFrom || new Date();

    const { collar: associatedCollar, sheep: associatedSheep } = await this.findActiveAssociationsOf(collarId, sheepId);

    if (associatedCollar) throw new Error(`The collar ${associatedCollar.id} - (${associatedCollar.name}) is already in use`);
    if (associatedSheep) throw new Error(`The collar ${associatedSheep.id} - (${associatedSheep.name}) is already in use`);

    const [collar, sheep] = await Promise.all([
      this.collarService.findByIdOrFail(collarId),
      this.sheepService.findByIdOrFail(sheepId, ['paddock']),
    ]);

    if (collar.establishmentId !== sheep.paddock.establishmentId)
      throw new Error('Collar and sheep are not in the same establishment');

    const association = this.sheepCollarRepository.create({ collarId, sheepId, assignedFrom });
    try {
      return await this.sheepCollarRepository.save(association);
    } catch (e) {
      Logger.error(e, 'SHEEP-COLLAR');
    }
  }

  async unassign(unassignCollarToSheepDto: UnassignCollarToSheepDto) {
    const { sheepId, collarId } = unassignCollarToSheepDto;
    const association = await this.sheepCollarRepository.findOne({
      where: { sheepId, collarId, assignedUntil: IsNull() },
      order: { id: 'DESC' },
    });
    if (!association) throw new NotFoundException('Association not found');
    association.assignedUntil = new Date();
    return this.sheepCollarRepository.save(association);
  }

  create(createSheepCollarDto: CreateSheepCollarDto) {
    return 'This action adds a new sheepCollar';
  }

  findAll() {
    return `This action returns all sheepCollar`;
  }

  findOne(id: number) {
    return `This action returns a #${id} sheepCollar`;
  }

  update(id: number, updateSheepCollarDto: UpdateSheepCollarDto) {
    return `This action updates a #${id} sheepCollar`;
  }

  remove(id: number) {
    return `This action removes a #${id} sheepCollar`;
  }
}
