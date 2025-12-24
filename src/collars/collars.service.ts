import { BadRequestException, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
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
    try {
      const { sheepId, ...collarData } = createCollarDto;
      
      const existingCollar = await this.collarRepository.findOne({
        where: { imei: createCollarDto.imei },
      });
      
      if (existingCollar) {
        throw new BadRequestException(`El IMEI ${createCollarDto.imei} ya está registrado en el sistema`);
      }

      const collar = this.collarRepository.create(collarData);
      collar.establishmentId = establishmentId;

      const savedCollar = await this.collarRepository.save(collar);
      if (sheepId) this.sheepCollarService.assign({ collarId: savedCollar.id, sheepId });
      return await this.findOne(savedCollar.id);
    } catch (e: any) {
      Logger.error(e);
      throw new BadRequestException('Error al crear el collar. Verifique que el IMEI no esté duplicado.');
    }
  }

  async update(
    establishmentId: EstablishmentEntity['id'],
    id: string,
    updateCollarDto: UpdateCollarDto
  ) {
    try {
      const collar = await this.findOne(id, false) as CollarEntity;
      const {sheepId: newSheepId, ...mergeCollar} = updateCollarDto;

      await this.sheepCollarService.handleAssociation(collar, newSheepId);
      const updatedCollar = this.collarRepository.merge(collar, mergeCollar);
      const savedCollar = await this.collarRepository.save(updatedCollar);

      return await this.findOne(savedCollar.id);
      
    } catch (e) {
      Logger.debug(e);
      throw new Error('Error al actualizar la oveja');
    }
  }



  async findAll(establishmentId: EstablishmentEntity['id'], filter?: CollarFilterDto) {
    const collars = await this.collarRepository
      .createQueryBuilder('collar')
      .where('collar.establishmentId = :establishmentId', { establishmentId })
      .leftJoin(
        SheepCollarEntity,
        'sc',
        'sc.collarId = collar.id AND sc.assignedUntil IS NULL'
      )
      .leftJoinAndMapOne('collar.sheep', 'sheep', 'sheep', 'sheep.id = sc.sheepId')
      .getMany();

    const imeis = collars.map((collar) => collar.imei);
    const dynamoDataMap = await this.dynamoDBCollarService.getMultipleCollarLastActivity(imeis);

    const collarsDtos = await Promise.all(
      collars.map(async (collar) => {
        const dynamoData = dynamoDataMap.get(Number(collar.imei));

        return {
          ...collar,
          latestLocation: dynamoData?.latestLocation,
          latestStatus: dynamoData?.latestStatus,
        }
      })
    );


    return collarsDtos;
  }

  getInitialInfo(imei: number, limit: number) {
    return this.dynamoDBCollarService.getCollarInitialInfo(imei, limit);
  }

  async findOne(id: string, toDto:boolean = false) {
    const collar = await this.collarRepository
      .createQueryBuilder('collar')
      .where('collar.id = :id', { id })
      .leftJoin(
        SheepCollarEntity,
        'sc',
        'sc.collarId = collar.id AND sc.assignedUntil IS NULL'
      )
      .leftJoinAndMapOne('collar.sheep', 'sheep', 'sheep', 'sheep.id = sc.sheepId')
      .getOne();

    if (!collar) throw new Error('Collar not found');

    

    // Fetch latest activity data from DynamoDB
    const dynamoData = await this.dynamoDBCollarService.getCollarLastActivity(collar.imei);

    return {
      ...collar,
      latestLocation: dynamoData?.latestLocation,
      latestStatus: dynamoData?.latestStatus,
    }

  }

  async remove(id: string) {
    await this.sheepCollarService.unassign({ collarId: id });
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
