import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';
import { CollarEntity } from './entities/collar.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EstablishmentsService } from 'src/establishments/establishments.service';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { SheepCollarEntity } from 'src/sheep-collar/entities/sheep-collar.entity';
import { SheepCollarService } from 'src/sheep-collar/sheep-collar.service';
import { CollarFilterDto } from './dto/collar-filter.dto';
import { AssignationStatus } from 'src/commons/enums/AssignationStatus.enum';
import { BaseService } from 'src/commons/services/base.service';
import { CollarDto } from './dto/collar.dto';
import { NotFoundError } from 'rxjs';

@Injectable()
export class CollarsService extends BaseService {
  constructor(
    @InjectRepository(CollarEntity)
    private collarRepository: Repository<CollarEntity>,
    @Inject(forwardRef(() => SheepCollarService))
    private sheepCollarService: SheepCollarService
  ) {
    super();
  }

  async create(establishmentId: EstablishmentEntity['id'], createCollarDto: CreateCollarDto) {
    const { sheepId, ...collarData } = createCollarDto;
    const collar = this.collarRepository.create(collarData);
    collar.establishmentId = establishmentId;

    const savedCollar = await this.collarRepository.save(collar);
    if (sheepId) this.sheepCollarService.assign({ collarId: savedCollar.id, sheepId });
    return savedCollar;
  }

  async update(establishmentId: EstablishmentEntity['id'], id: string, updateCollarDto: UpdateCollarDto) {
    try {
      const collar = await this.findByIdOrFail(id);

      if (collar.sheepId !== updateCollarDto.sheepId) {
        //change in collarId
        if (collar.sheepId) {
          console.log('Bueno, hubo cambio aa');
          await this.sheepCollarService.unassign({ collarId: collar.id, sheepId: collar.sheepId });
        }
        if (updateCollarDto.sheepId) {
          console.log('guarde el cambio aa');
          await this.sheepCollarService.assign({ collarId: collar.id, sheepId: updateCollarDto.sheepId });
        }
      }

      const updatedCollar = this.collarRepository.merge(collar, updateCollarDto);
      console.log('SHEEEP Merging ', collar, ' with ', updateCollarDto, ' to get ', updatedCollar);

      return await this.collarRepository.save(updatedCollar);
    } catch (e) {
      Logger.debug(e);
      throw new Error('Error al actualizar la oveja');
    }
  }

  async updateSheep(collarId: string, sheepId: string | null) {
    const collar = await this.collarRepository.findOneBy({ id: collarId });
    if (collar) {
      collar.sheepId = sheepId;
      return this.collarRepository.save(collar);
    }
  }

  async findAll(establishmentId: EstablishmentEntity['id'], filter?: CollarFilterDto) {
    const collars = await this.collarRepository.find({ where: { establishmentId }, relations: ['sheep'] });
    const collarsDtos = collars.map((collar) =>
      this.toDto(CollarDto, collar, {
        sheep: collar.sheep ? { id: collar.sheep.id, name: collar.sheep.name } : null,
      })
    );

    if (filter?.status) {
      return collarsDtos.filter((collar) => {
        const isAssociated = Boolean(collar.sheep?.id);
        return (
          (filter.status === AssignationStatus.ASSIGNED && isAssociated) ||
          (filter.status !== AssignationStatus.ASSIGNED && !isAssociated)
        );
      });
    }

    return collarsDtos;
  }

  async findOne(id: string) {
    const collar = await this.collarRepository.findOne({
      where: { id },
      // loadRelationIds: {
      //   relations: ['establishment'],
      //   disableMixedMap: true,
      // },
      relations: ['sheep'],
    });
    console.log('El collar es', collar);
    if (!collar) throw new Error('Collar not found');

    const collarDto = this.toDto(CollarDto, collar);
    console.log('El DTO es ', collarDto);
    return collarDto;
  }

  remove(id: number) {
    return `This action removes a #${id} collar`;
  }

  findById(id: string) {
    if (!id) throw new Error('La id del collar no puede ser vacía');
    return this.collarRepository.findOneByOrFail({ id: id ?? '' });
  }

  findByIdOrFail(id: string) {
    if (!id) throw new Error('La id del collar no puede ser vacía');
    return this.collarRepository.findOneByOrFail({ id: id ?? '' });
  }

  findByIds(ids: string[]): Promise<CollarEntity[]> {
    return this.collarRepository.findBy({ id: In(ids) });
  }
}
