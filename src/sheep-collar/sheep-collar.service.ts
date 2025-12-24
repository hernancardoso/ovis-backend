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
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';

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
   * Find the active association for a collar or sheep
   * @param collarId - The collar id
   * @param sheepId - The sheep id
   * @returns The active association
   */
  findActiveAssociation({collarId, sheepId}:{collarId?: string, sheepId?: string}) {
    const where =  collarId 
      ? { collarId, isActive: true } 
      : { sheepId, isActive: true };
    
    return this.sheepCollarRepository.findOne({
      where,
      order: { assignedFrom: 'DESC' },
    });
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

  /**
   * Assign a collar to a sheep
   * @param assignCollarToSheepDto - The collar and sheep to assign
   * Note: This method will close any active association for the collar or sheep if it is already assigned to another entity.
   * If the association is already active, it will return the existing association.
   * If the association is not active, it will create a new association.
   * @returns The assigned association
   * @throws QueryFailedError if database constraint is violated
   */
  async assign(assignCollarToSheepDto: AssignCollarToSheepDto): Promise<SheepCollarEntity> {
    const { collarId, sheepId } = assignCollarToSheepDto;

    // Check if this exact association already exists and is active
    const existingAssociation = await this.sheepCollarRepository.findOne({
      where: { sheepId, collarId, isActive: true },
    });

    // If the same association is already active, return it
    if (existingAssociation) {
      return existingAssociation;
    }

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
    
    // Let errors propagate - they will be caught by NestJS exception filter
    return await this.sheepCollarRepository.save(associationEntity);
  }

  /**
   * Unassign a collar from a sheep or a sheep from a collar
   * @param collarId - The collar id
   * @param sheepId - The sheep id
   * @returns The unassigned association entity
   * @throws NotFoundException if association is not found
   */
  async unassign({collarId, sheepId}:{collarId?: string, sheepId?: string}): Promise<SheepCollarEntity> {
    const association = await this.findActiveAssociation({collarId, sheepId});

    if (!association) {
      throw new NotFoundException('Association not found');
    }
    
    association.assignedUntil = new Date();
    return await this.sheepCollarRepository.save(association);
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
  


  async handleAssociation(sheep: SheepEntity, collarId: string | null): Promise<SheepCollarEntity | null>;
  async handleAssociation(collar: CollarEntity, sheepId: string | null): Promise<SheepCollarEntity | null>;
  
  async handleAssociation(
    entity: SheepEntity | CollarEntity,
    id: string | null,
  ): Promise<SheepCollarEntity | null> {  
    if (entity instanceof SheepEntity) {
      const sheepId = entity.id;
      const newCollarId = id;
      

      const currentAssociation = await this.findActiveAssociation({ sheepId });
      if (currentAssociation) {
        if (newCollarId === null || newCollarId === '') {
          return await this.unassign({ sheepId });
        } else {
          if (newCollarId === currentAssociation.collarId) {
            return currentAssociation;
          } else {
            return await this.assign({ sheepId, collarId: newCollarId });
          }
        }
      } else {
        if (newCollarId === null || newCollarId === '') {
          return null;
        } else {
          return await this.assign({ sheepId, collarId: newCollarId });
        }
      }
      
    } else {
      const collarId = entity.id;
      const newSheepId = id;

      const currentAssociation = await this.findActiveAssociation({ collarId });
      if (currentAssociation) {
        if (newSheepId === null || newSheepId === '') {
          return await this.unassign({ collarId });
        } else {
          if (newSheepId === currentAssociation.collarId) {
            return currentAssociation;
          } else {
            return await this.assign({ collarId, sheepId: newSheepId });
          }
        }
      } else {
        if (newSheepId === null || newSheepId === '') {
          return null;
        } else {
          return await this.assign({ collarId, sheepId: newSheepId });
        }
      }
    }
  }

  async delete({ collarId, sheepId, assignedFrom, assignedUntil }: { collarId: string, sheepId: string, assignedFrom: Date, assignedUntil?: Date | null }) {
    const where: any = { 
      sheepId, 
      collarId, 
      assignedFrom 
    };

    if (assignedUntil !== undefined) {
      if (assignedUntil === null) {
        where.assignedUntil = IsNull();
      } else {
        where.assignedUntil = assignedUntil;
      }
    }

    // Check if association exists before soft deleting
    const existingAssociation = await this.sheepCollarRepository.findOne({
      where,
    });

    if (!existingAssociation) {
      throw new NotFoundException('Association not found');
    }
    
    // Use softDelete instead of remove for soft delete
    await this.sheepCollarRepository.softDelete(where);
    return { success: true };
  }


}
