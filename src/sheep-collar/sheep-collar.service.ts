import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SheepCollarEntity } from './entities/sheep-collar.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AssignCollarToSheepDto } from './dto/assign-collar-to-sheep.dto';
import { UnassignCollarToSheepDto } from './dto/unassign-collar-to-sheep.dto copy';
import { CollarsService } from 'src/collars/collars.service';
import { EitherOr } from 'src/commons/types/EitherOr.type';
import { BaseService } from 'src/commons/services/base.service';
import { SheepCollarDto } from './dto/sheep-collar.dto';

@Injectable()
export class SheepCollarService extends BaseService {
  constructor(
    @InjectRepository(SheepCollarEntity)
    private sheepCollarRepository: Repository<SheepCollarEntity>,
    @Inject(forwardRef(() => CollarsService))
    private collarService: CollarsService
  ) {
    super();
  }

  /**
   * Check if a collar or sheep is currently associated (has an active assignment)
   */
  isAssociated({ collarId, sheepId }: EitherOr<{ collarId: string }, { sheepId: string }>) {
    const where = collarId 
      ? { collarId, assignedUntil: IsNull() } 
      : { sheepId, assignedUntil: IsNull() };
    
    return this.sheepCollarRepository.findOne({
      where,
      order: { assignedFrom: 'DESC' },
    });
  }

  async assign(assignCollarToSheepDto: AssignCollarToSheepDto) {
    const { collarId, sheepId } = assignCollarToSheepDto;

    // Close any active association for this collar (if assigned to another sheep)
    const activeForCollar = await this.isAssociated({ collarId });
    if (activeForCollar && activeForCollar.sheepId !== sheepId) {
      activeForCollar.assignedUntil = new Date();
      await this.sheepCollarRepository.save(activeForCollar);

    }

    // Close any active association for this sheep (if it has another collar)
    const activeForSheep = await this.isAssociated({ sheepId });
    if (activeForSheep && activeForSheep.collarId !== collarId) {
      activeForSheep.assignedUntil = new Date();
      await this.sheepCollarRepository.save(activeForSheep);
      
    }

    // Create new active association
    const assignedFrom = assignCollarToSheepDto.assignedFrom ?? new Date();
    const associationEntity = this.sheepCollarRepository.create({ collarId, sheepId, assignedFrom });
    
    try {
      await this.sheepCollarRepository.save(associationEntity);
    } catch (e) {
      Logger.error(e, 'SHEEP-COLLAR');
    }
  }

  async unassign(unassignCollarToSheepDto: UnassignCollarToSheepDto) {
    const { sheepId, collarId } = unassignCollarToSheepDto;
    const association = await this.sheepCollarRepository.findOne({
      where: { sheepId, collarId, assignedUntil: IsNull() },
      order: { assignedFrom: 'DESC' },
    });
    if (!association) throw new NotFoundException('Association not found');
    association.assignedUntil = new Date();
    return this.sheepCollarRepository.save(association);
  }

  async findAll(id: string) {
    const associations = await this.sheepCollarRepository.find({
      where: [{ collarId: id }, { sheepId: id }],
      order: { assignedFrom: 'DESC' },
      relations: ['collar', 'sheep'],
    });

    return associations.map((association) =>
      this.toDto(SheepCollarDto, association, {
        collar: { id: association.collar.id, name: association.collar.name },
        sheep: { id: association.sheep.id, name: association.sheep.name },
      })
    );
  }
}
