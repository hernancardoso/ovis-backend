import { forwardRef, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { CreateSheepDto } from './dto/create-sheep.dto';
import { UpdateSheepDto } from './dto/update-sheep.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { SheepEntity } from './entities/sheep.entity';
import { Repository, In } from 'typeorm';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { PaddocksService } from 'src/paddocks/paddocks.service';
import { SheepCollarService } from 'src/sheep-collar/sheep-collar.service';
import { SheepFilterDto } from './dto/filter-sheep-dto';
import { AssignationStatus } from 'src/commons/enums/AssignationStatus.enum';
import { SheepDto } from './dto/sheep.dto';
import { BaseService } from 'src/commons/services/base.service';
import { PaddockEntity } from 'src/paddocks/entities/paddock.entity';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { SheepCollarEntity } from 'src/sheep-collar/entities/sheep-collar.entity';

@Injectable()
export class SheepService extends BaseService {
  constructor(
    @InjectRepository(SheepEntity)
    private sheepRepository: Repository<SheepEntity>,
    @Inject(forwardRef(() => PaddocksService))
    private paddocksService: PaddocksService,
    @Inject(forwardRef(() => SheepCollarService))
    private sheepCollarService: SheepCollarService
  ) {
    super();
  }

  async create(establishmentId: EstablishmentEntity['id'], createSheepDto: CreateSheepDto) {
    try {
      const sheep = await this.sheepRepository.save(this.sheepRepository.create(createSheepDto));
      if (createSheepDto.collarId) {
        try {
          await this.sheepCollarService.assign({
            sheepId: sheep.id,
            collarId: createSheepDto.collarId,
          });
        } catch (e) {
          console.log('El collar seleccionado no está disponible');
        }
      }
      return sheep;
    } catch (e) {
      Logger.error(e);
      throw new Error(
        'Error al crear la oveja, intente nuevamente - collarId o paddockId incorrectos'
      );
    }
  }

  async update(
    establishmentId: EstablishmentEntity['id'],
    id: string,
    updateSheepDto: UpdateSheepDto
  ) {
    try {
      const sheep = await this.findOne(id);

      if(updateSheepDto.collarId) {
        await this.sheepCollarService.assign({
          collarId: updateSheepDto.collarId,
          sheepId: id,
        });
      } else  if (sheep && sheep.collar && sheep.collar.id && !updateSheepDto.collarId) {
        await this.sheepCollarService.unassign({ sheepId: id, collarId: sheep.collar.id });
      }

      const updatedSheep = this.sheepRepository.merge(sheep, updateSheepDto);
      await this.sheepRepository.save(updatedSheep);
    
      return this.toSheepDto(updatedSheep);

    } catch (e) {
      Logger.debug(e);
      throw new Error('Error al actualizar la oveja');
    }
  }

  async findByIdOrFail(id: string, relations: ('paddock' | 'collar')[] = []) {
    if (!id) throw new Error('La id del collar no puede ser vacía');
    return await this.sheepRepository.findOneOrFail({ where: { id: id ?? '' }, relations });
  }

  private toSheepDto(sheep: SheepEntity) {
    return this.toDto(SheepDto, sheep, {
      collar: sheep.collar ? { id: sheep.collar.id, name: sheep.collar.name } : undefined,
      paddock: sheep.paddock ? { id: sheep.paddock.id, name: sheep.paddock.name } : undefined,
      breed: sheep.breed ? { id: sheep.breed.id.toString(), name: sheep.breed.name } : undefined,
    });
  }

  async findAll(establishmentId: EstablishmentEntity['id'], filter?: SheepFilterDto) {
    const sheepIds = await this.paddocksService.getSheepIdsFrom({ establishmentId });

    const sheep = (await this.findByIds(sheepIds)).map((sheep) => this.toSheepDto(sheep));

    if (filter?.status) {
      return sheep.filter((sheep) => {
        const isAssociated = Boolean(sheep.collar?.id);
        return (
          (filter.status === AssignationStatus.ASSIGNED && isAssociated) ||
          (filter.status !== AssignationStatus.ASSIGNED && !isAssociated)
        );
      });
    }

    return sheep;
  }

  async findByIds(ids: string[]): Promise<SheepEntity[]> {
    if (ids.length === 0) return [];
    return await this.sheepRepository
      .createQueryBuilder('sheep')
      .leftJoinAndSelect('sheep.paddock', 'paddock')
      .leftJoinAndSelect('sheep.breed', 'breed')
      .leftJoin(SheepCollarEntity, 'sc', 'sc.sheepId = sheep.id AND sc.assignedUntil IS NULL')
      .leftJoinAndMapOne('sheep.collar', CollarEntity, 'collar', 'collar.id = sc.collarId')
      .where('sheep.id IN (:...ids)', { ids })
      .getMany();
  }

  async findOne(id: SheepEntity['id']) {
    const sheep = await this.sheepRepository
      .createQueryBuilder('sheep')
      .leftJoinAndSelect('sheep.paddock', 'paddock')
      .leftJoinAndSelect('sheep.breed', 'breed')
      .leftJoin(SheepCollarEntity, 'sc', 'sc.sheepId = sheep.id AND sc.assignedUntil IS NULL')
      .leftJoinAndMapOne('sheep.collar', CollarEntity, 'collar', 'collar.id = sc.collarId')
      .where('sheep.id = :id', { id })
      .getOne();
    
    console.log('SHEEP FOUND: ', sheep);

    if (!sheep) throw new Error('Collar not found');

    return sheep;
  }

  async remove(id: SheepEntity['id']) {
    const result = await this.sheepRepository.softDelete({ id });

    if (!result.affected) throw new Error('No se pudo borrar');

    return true;
  }
}
