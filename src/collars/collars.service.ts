import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
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
        throw new BadRequestException(
          `El IMEI ${createCollarDto.imei} ya está registrado en el sistema`
        );
      }

      const collar = this.collarRepository.create(collarData);
      collar.establishmentId = establishmentId;

      const savedCollar = await this.collarRepository.save(collar);
      if (sheepId) this.sheepCollarService.assign({ collarId: savedCollar.id, sheepId });
      return await this.findOne(savedCollar.id);
    } catch (e: any) {
      Logger.error(e);
      throw new BadRequestException(
        'Error al crear el collar. Verifique que el IMEI no esté duplicado.'
      );
    }
  }

  async update(
    establishmentId: EstablishmentEntity['id'],
    id: string,
    updateCollarDto: UpdateCollarDto
  ) {
    try {
      const collar = (await this.findOne(id)) as CollarEntity;
      const { sheepId: newSheepId, ...mergeCollar } = updateCollarDto;

      await this.sheepCollarService.handleAssociation(collar, newSheepId);

      if (mergeCollar.imei && mergeCollar.imei !== collar.imei) {
        const existingCollar = await this.collarRepository.findOne({
          where: { imei: mergeCollar.imei },
        });

        if (existingCollar && existingCollar.id !== id) {
          throw new BadRequestException(
            `El IMEI ${mergeCollar.imei} ya está registrado en el sistema`
          );
        }
      }

      const updatedCollar = this.collarRepository.merge(collar, mergeCollar);
      const savedCollar = await this.collarRepository.save(updatedCollar);

      return await this.findOne(savedCollar.id);
    } catch (e) {
      Logger.debug(e);
      throw new Error('Error al actualizar la oveja');
    }
  }

  async findOne(id: string) {
    const collar = await this.buildCollarQueryBuilder().where('collar.id = :id', { id }).getOne();

    if (!collar) throw new Error('Collar not found');

    const [result] = await this.dynamoDBCollarService.enrichCollarsWithActivityData([collar]);
    return result;
  }

  async findByIds(ids: string[]) {
    if (!ids || ids.length === 0) {
      return [];
    }

    const collars = await this.buildCollarQueryBuilder()
      .where('collar.id IN (:...ids)', { ids })
      .getMany();

    return this.dynamoDBCollarService.enrichCollarsWithActivityData(collars);
  }

  async remove(id: string) {
    const collar = await this.findOne(id);

    await this.sheepCollarService.handleAssociation(collar, null);
    await this.collarRepository.softRemove(collar);

    return true;
  }

  async findAll(establishmentId: EstablishmentEntity['id'], filter?: CollarFilterDto) {
    const collars = await this.buildCollarQueryBuilder()
      .where('collar.establishmentId = :establishmentId', { establishmentId })
      .getMany();

    return this.dynamoDBCollarService.enrichCollarsWithActivityData(collars);
  }

  async findOneInEstablishment(
    establishmentId: EstablishmentEntity['id'],
    id: string
  ): Promise<CollarEntity> {
    const collar = await this.collarRepository.findOne({
      where: { id, establishmentId },
    });
    if (!collar) throw new NotFoundException('Collar not found');
    return collar;
  }

  getInitialInfo(imei: number, limit: number) {
    return this.dynamoDBCollarService.getCollarInitialInfo(imei, limit);
  }

  private buildCollarQueryBuilder() {
    return this.collarRepository
      .createQueryBuilder('collar')
      .leftJoin(SheepCollarEntity, 'sc', 'sc.collarId = collar.id AND sc.assignedUntil IS NULL')
      .leftJoinAndMapOne('collar.sheep', 'sheep', 'sheep', 'sheep.id = sc.sheepId');
  }
}
