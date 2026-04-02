import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SheepCollarEntity } from './entities/sheep-collar.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { AssignCollarToSheepDto } from './dto/assign-collar-to-sheep.dto';
import { CollarsService } from 'src/collars/collars.service';
import { EitherOr } from 'src/commons/types/EitherOr.type';
import { BaseService } from 'src/commons/services/base.service';
import { SheepCollarDto } from './dto/sheep-collar.dto';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';

export type SheepAssociationInterval = {
  collarId: string;
  from: Date;
  to: Date | null;
};

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
   * If both are provided, finds the specific association between them.
   * If only one is provided, finds any active association for that entity.
   */
  findActiveAssociation({ collarId, sheepId }: { collarId?: string; sheepId?: string }) {
    const where: any = { isActive: true };

    if (collarId) where.collarId = collarId;
    if (sheepId) where.sheepId = sheepId;

    return this.sheepCollarRepository.findOne({
      where,
      order: { assignedFrom: 'DESC' },
    });
  }

  /**
   * Check if a collar or sheep is currently associated (has an active assignment)
   */
  isAssociated({ collarId, sheepId }: EitherOr<{ collarId: string }, { sheepId: string }>) {
    const where = collarId ? { collarId, isActive: true } : { sheepId, isActive: true };

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
  async assign(dto: AssignCollarToSheepDto): Promise<SheepCollarEntity> {
    const { sheepId, collarId } = dto;

    return this.sheepCollarRepository.manager.transaction(async (em) => {
      const repo = em.getRepository(SheepCollarEntity);
      const now = dto.assignedFrom ?? new Date();

      // 1️⃣ misma asociación ya activa → devolverla
      const sameActive = await repo.findOne({
        where: { sheepId, collarId, isActive: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (sameActive) {
        return sameActive;
      }

      // 2️⃣ cerrar activo del collar (si existe)
      const activeForCollar = await repo.findOne({
        where: { collarId, isActive: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (activeForCollar) {
        activeForCollar.assignedUntil = now;
        await repo.save(activeForCollar);
      }

      // 3️⃣ cerrar activo de la sheep (si existe)
      const activeForSheep = await repo.findOne({
        where: { sheepId, isActive: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (activeForSheep) {
        activeForSheep.assignedUntil = now;
        await repo.save(activeForSheep);
      }

      // 4️⃣ crear nueva asociación
      const newAssociation = repo.create({
        sheepId,
        collarId,
        assignedFrom: now,
      });

      return repo.save(newAssociation);
    });
  }

  /**
   * Unassign a collar from a sheep or a sheep from a collar
   * @param collarId - The collar id
   * @param sheepId - The sheep id
   * @returns The unassigned association entity
   * @throws NotFoundException if association is not found
   */
  async unassign({
    collarId,
    sheepId,
  }: {
    collarId?: string;
    sheepId?: string;
  }): Promise<SheepCollarEntity> {
    const association = await this.findActiveAssociation({ collarId, sheepId });

    if (!association) {
      throw new NotFoundException('Association not found');
    }

    association.assignedUntil = new Date();
    return await this.sheepCollarRepository.save(association);
  }

  async findAll(id: string) {
    const associations = await this.sheepCollarRepository
      .createQueryBuilder('sc')
      .innerJoinAndSelect('sc.collar', 'collar', 'collar.deletedAt IS NULL')
      .innerJoinAndSelect('sc.sheep', 'sheep', 'sheep.deletedAt IS NULL')
      .where('(sc.collarId = :id)', { id })
      .orderBy('sc.assignedFrom', 'DESC')
      .getMany();

    return associations.map((association) =>
      this.toDto(SheepCollarDto, association, {
        collar: { id: association.collar.id, name: association.collar.name },
        sheep: { id: association.sheep.id, name: association.sheep.name },
      })
    );
  }

  /**
   * Return every collar association for a sheep that overlaps the requested interval.
   *
   * Associations are treated as [assignedFrom, assignedUntil), so a record that ends
   * exactly at `start` is not considered part of the interval.
   */
  async findAssociationsForSheepWithinInterval({
    sheepId,
    start,
    end,
  }: {
    sheepId: string;
    start: Date;
    end: Date;
  }): Promise<SheepAssociationInterval[]> {
    if (start > end) {
      throw new BadRequestException('Start date must be before or equal to end date');
    }

    const associations = await this.sheepCollarRepository.find({
      where: [
        {
          sheepId,
          assignedFrom: LessThanOrEqual(end),
          assignedUntil: IsNull(),
        },
        {
          sheepId,
          assignedFrom: LessThanOrEqual(end),
          assignedUntil: MoreThan(start),
        },
      ],
      order: { assignedFrom: 'ASC' },
    });

    return associations.map(({ collarId, assignedFrom, assignedUntil }) => ({
      collarId,
      from: assignedFrom,
      to: assignedUntil ?? null,
    }));
  }

  async handleAssociation(
    sheep: SheepEntity,
    collarId: string | null
  ): Promise<SheepCollarEntity | null>;
  async handleAssociation(
    collar: CollarEntity,
    sheepId: string | null
  ): Promise<SheepCollarEntity | null>;

  async handleAssociation(
    entity: SheepEntity | CollarEntity,
    id: string | null
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
          if (newSheepId === currentAssociation.sheepId) {
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

  async delete({
    collarId,
    sheepId,
    assignedFrom,
    assignedUntil,
  }: {
    collarId: string;
    sheepId: string;
    assignedFrom: Date;
    assignedUntil?: Date | null;
  }) {
    const where: any = {
      sheepId,
      collarId,
      assignedFrom,
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
