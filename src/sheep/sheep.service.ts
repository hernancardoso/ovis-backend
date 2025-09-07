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
      const sheep = await this.findByIdOrFail(id);

      if (sheep.collarId !== updateSheepDto.collarId) {
        //change in collarId
        if (sheep.collarId) {
          console.log('Bueno, hubo cambio');
          await this.sheepCollarService.unassign({ collarId: sheep.collarId, sheepId: sheep.id });
        }
        if (updateSheepDto.collarId) {
          console.log('guarde el cambio');
          await this.sheepCollarService.assign({
            collarId: updateSheepDto.collarId,
            sheepId: sheep.id,
          });
        }
      }

      const updatedSheep = this.sheepRepository.merge(sheep, updateSheepDto);
      console.log('Merging ', sheep, ' with ', updateSheepDto, ' to get ', updatedSheep);

      return await this.sheepRepository.save(updatedSheep);
    } catch (e) {
      Logger.debug(e);
      throw new Error('Error al actualizar la oveja');
    }
  }

  async updateCollar(sheepId: string, collarId: string | null) {
    const sheep = await this.sheepRepository.findOneBy({ id: sheepId });
    console.log('La encontre, ', sheep);
    if (sheep) {
      sheep.collarId = collarId;
      console.log('Quedo , ', sheep);
      return this.sheepRepository.save(sheep);
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

    const sheep = (await this.findByIds(sheepIds, ['paddock', 'collar'])).map((sheep) =>
      this.toSheepDto(sheep)
    );

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

  async findByIds(ids: string[], relations?: string[]): Promise<SheepEntity[]> {
    return await this.sheepRepository.find({ where: { id: In(ids) }, relations });
  }

  async findOne(id: SheepEntity['id']) {
    const sheep = await this.sheepRepository.findOne({
      where: { id },
      relations: ['collar', 'paddock', 'breed'],
    });

    if (!sheep) throw new Error('Collar not found');

    return this.toSheepDto(sheep);
  }

  async remove(id: SheepEntity['id']) {
    const result = await this.sheepRepository.softDelete({ id });

    if (!result.affected) throw new Error('No se pudo borrar');

    return true;
  }
}
