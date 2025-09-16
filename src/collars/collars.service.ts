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
import { DynamoDBCollarService } from './services/dynamodb-collar.service';

@Injectable()
export class CollarsService extends BaseService {
  constructor(
    @InjectRepository(CollarEntity)
    private collarRepository: Repository<CollarEntity>,
    @Inject(forwardRef(() => SheepCollarService))
    private sheepCollarService: SheepCollarService,
    private dynamoDBCollarService: DynamoDBCollarService
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

  async update(
    establishmentId: EstablishmentEntity['id'],
    id: string,
    updateCollarDto: UpdateCollarDto
  ) {
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
          await this.sheepCollarService.assign({
            collarId: collar.id,
            sheepId: updateCollarDto.sheepId,
          });
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

  private async toCollarDto(
    collar: CollarEntity,
    dynamoData?: { latestLocation?: any; latestStatus?: any }
  ) {
    return this.toDto(CollarDto, collar, {
      sheep: collar.sheep
        ? { id: collar.sheep.id, name: collar.sheep.name, tags: collar.sheep.tags }
        : null,
      latestLocation: dynamoData?.latestLocation || null,
      latestStatus: dynamoData?.latestStatus || null,
    });
  }

  async findAll(establishmentId: EstablishmentEntity['id'], filter?: CollarFilterDto) {
    const collars = await this.collarRepository.find({
      where: { establishmentId },
      relations: ['sheep'],
    });

    // Get IMEIs for DynamoDB lookup
    const imeis = collars.map((collar) => collar.imei);

    // Fetch latest activity data from DynamoDB
    const dynamoDataMap = await this.dynamoDBCollarService.getMultipleCollarLastActivity(imeis);

    // Create DTOs with DynamoDB data
    const collarsDtos = await Promise.all(
      collars.map(async (collar) => {
        const dynamoData = dynamoDataMap.get(Number(collar.imei));

        return this.toCollarDto(collar, {
          latestLocation: dynamoData?.latestLocation,
          latestStatus: dynamoData?.latestStatus,
        });
      })
    );

    console.log(collarsDtos);
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

  getInitialInfo(imei: number, limit: number) {
    return this.dynamoDBCollarService.getCollarInitialInfo(imei, limit);
  }

  async findOne(id: string, relations?: string[]) {
    const collar = await this.collarRepository.findOne({
      where: { id },
      relations: ['sheep'],
    });

    if (!collar) throw new Error('Collar not found');

    // Fetch latest activity data from DynamoDB
    const dynamoData = await this.dynamoDBCollarService.getCollarLastActivity(collar.imei);

    const collarDto = await this.toCollarDto(collar, {
      latestLocation: dynamoData?.latestLocation,
      latestStatus: dynamoData?.latestStatus,
    });

    console.log(collarDto);
    return collarDto;
  }

  async remove(id: string) {
    const result = await this.collarRepository.softDelete({ id });

    if (!result.affected) throw new Error('No se pudo borrar');

    return true;
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
