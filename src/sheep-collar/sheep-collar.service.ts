import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { Collar } from 'src/collars/models/collar.model';
import { EitherOr } from 'src/commons/types/EitherOr.type';

@Injectable()
export class SheepCollarService {
  constructor(
    @InjectRepository(SheepCollarEntity)
    private sheepCollarRepository: Repository<SheepCollarEntity>,
    @Inject(forwardRef(() => CollarsService))
    private collarService: CollarsService,
    private sheepService: SheepService,
    private paddocksService: PaddocksService
  ) {}

  isAssociated({ collarId, sheepId }: EitherOr<{ collarId: string }, { sheepId: string }>) {
    return this.sheepCollarRepository.findOne({
      where: [{ collarId }, { sheepId }],
      order: { id: 'DESC' },
    });
  }

  private async findActiveAssociations(collarId: string, sheepId: string) {
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

    const { collar: collarFound, sheep: sheepFound } = await this.findActiveAssociations(collarId, sheepId);
    if (collarFound) throw new Error(`The collar ${collarFound.id} - (${collarFound.name}) is already in use`);
    if (sheepFound) throw new Error(`The collar ${sheepFound.id} - (${sheepFound.name}) is already in use`);

    // if (collar.establishmentId !== sheep.paddock.establishmentId)
    //   throw new Error('Collar and sheep are not in the same establishment');

    const assignedFrom = assignCollarToSheepDto.assignedFrom ?? new Date();
    const associationEntity = this.sheepCollarRepository.create({ collarId, sheepId, assignedFrom });
    try {
      await this.sheepCollarRepository.save(associationEntity);

      await this.collarService.updateSheep(collarId, sheepId);
      await this.sheepService.updateCollar(sheepId, collarId);
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
    await this.collarService.updateSheep(collarId, null);
    await this.sheepService.updateCollar(sheepId, null);

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
