import { Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { CreateEstablishmentDto } from './dto/create-establishment.dto';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto';
import { EstablishmentEntity } from './entities/establishment.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { CollarsService } from 'src/collars/collars.service';

import { Collar } from 'src/collars/models/collar.model';
import { BreedsService } from 'src/breeds/breeds.service';
import { BreedsEntity } from 'src/breeds/entities/breed.entity';
import { UpdateBreedsDto } from './dto/update-breeds.dto';
import { FindOneOptions, FindOptionsWhere, FindOptionsRelations } from 'typeorm';
import { PaddocksService } from 'src/paddocks/paddocks.service';
import { SheepService } from 'src/sheep/sheep.service';
import { PaddockEntity } from 'src/paddocks/entities/paddock.entity';
import { UserManagementService } from 'src/auth/user-management.service';

@Injectable()
export class EstablishmentsService {
  constructor(
    @InjectRepository(EstablishmentEntity)
    private establishmentRepository: Repository<EstablishmentEntity>,
    @InjectRepository(PaddockEntity)
    private paddockRepository: Repository<PaddockEntity>,
    @Inject(forwardRef(() => CollarsService))
    private collarService: CollarsService,
    @Inject(forwardRef(() => PaddocksService))
    private paddocksService: PaddocksService,
    @Inject(forwardRef(() => SheepService))
    private sheepService: SheepService,
    private readonly breedsService: BreedsService,
    private readonly userManagementService: UserManagementService
  ) {}

  async create(createEstablishmentDto: CreateEstablishmentDto): Promise<EstablishmentEntity> {
    const establishment = this.establishmentRepository.create({
      ...createEstablishmentDto,
      onlineThresholdHours: createEstablishmentDto.onlineThresholdHours ?? 1,
      staleThresholdHours: createEstablishmentDto.staleThresholdHours ?? 24,
    });

    if (createEstablishmentDto?.collarIds?.length) {
      const collars = await this.collarService.findByIds(createEstablishmentDto.collarIds);

      if (collars.length !== createEstablishmentDto.collarIds.length)
        throw new Error('One or more collar IDs are invalid');

      establishment.collars = collars;
    }

    return this.establishmentRepository.save(establishment);
  }

  async update(id: string, updateEstablishmentDto: UpdateEstablishmentDto) {
    const establishment = await this.findById(id);
    establishment.name = updateEstablishmentDto.name ?? establishment.name; //if updateEstablishmentDto.name is empty use the last name saved
    establishment.tags = updateEstablishmentDto.tags ?? [];
    
    if (updateEstablishmentDto.onlineThresholdHours !== undefined) {
      establishment.onlineThresholdHours = updateEstablishmentDto.onlineThresholdHours;
    }
    
    if (updateEstablishmentDto.staleThresholdHours !== undefined) {
      establishment.staleThresholdHours = updateEstablishmentDto.staleThresholdHours;
    }
    
    // if (updateEstablishmentDto.collarIds?.length) {
    //   const newCollars = await this.collarService.findByIds(updateEstablishmentDto.collarIds);
    //   if (newCollars.length !== updateEstablishmentDto.collarIds.length)
    //     throw new Error('One or more collar IDs are invalid');

    //   establishment.collars = newCollars;
    // }

    return this.establishmentRepository.save(establishment);
  }

  async listBreeds(id: EstablishmentEntity['id']): Promise<BreedsEntity[] | []> {
    const establishment = await this.establishmentRepository.findOne({
      where: { id },
      relations: ['breeds'],
    });
    return establishment?.breeds ?? [];
  }

  async updateBreeds(id: EstablishmentEntity['id'], updateBreedsDto: UpdateBreedsDto) {
    const establishment = await this.establishmentRepository.findOneOrFail({
      where: { id },
      relations: ['breeds'],
    });
    const breeds = await this.breedsService.find(updateBreedsDto.breedsIds);

    establishment.breeds = breeds;

    return this.establishmentRepository.save(establishment);
  }

  async findByIdOrFail(
    id: string,
    relations?: (keyof FindOptionsRelations<EstablishmentEntity>)[]
  ) {
    if (!id) throw new Error('La id del collar no puede ser vacía');
    try {
      return await this.establishmentRepository.findOneOrFail({ where: { id: id ?? '' }, relations });
    } catch (error) {
      if (error.name === 'EntityNotFoundError') {
        throw new NotFoundException(`Establishment with id ${id} not found`);
      }
      throw error;
    }
  }

  async findAll() {
    return this.establishmentRepository.find({
      relations: ['breeds', 'collars', 'paddocks', 'paddocks.sheep'],
    });
  }

  async findById(id: string) {
    if (!id) throw new Error('La id del establecimiento no puede ser vacía');
    return this.establishmentRepository.findOneByOrFail({ id });
  }

  async findOne(id: string) {
    return `This action returns a #establishments`;
  }

  async getCollars(id: string) {
    const establishment = await this.establishmentRepository.findOneOrFail({
      where: { id },
      relations: ['collars'],
    });

    return establishment.collars;
  }

  async remove(id: string) {
    // Buscar el establecimiento con todas sus relaciones
    const establishment = await this.establishmentRepository.findOneOrFail({
      where: { id },
      relations: ['collars', 'paddocks', 'paddocks.sheep', 'breeds'],
    });

    // Eliminar todas las ovejas de los corrales
    if (establishment.paddocks && establishment.paddocks.length > 0) {
      const allSheepIds: string[] = [];
      for (const paddock of establishment.paddocks) {
        if (paddock.sheep && paddock.sheep.length > 0) {
          for (const sheep of paddock.sheep) {
            allSheepIds.push(sheep.id);
          }
        }
      }
      
      // Eliminar las ovejas (soft delete)
      for (const sheepId of allSheepIds) {
        try {
          await this.sheepService.remove(sheepId);
        } catch (error) {
          Logger.warn(`Error al eliminar oveja ${sheepId}: ${error.message}`);
        }
      }

      // Eliminar los corrales (soft delete)
      // Como ya eliminamos las ovejas, podemos eliminar los corrales directamente
      for (const paddock of establishment.paddocks) {
        try {
          await this.paddockRepository.softDelete({ id: paddock.id });
        } catch (error) {
          Logger.warn(`Error al eliminar corral ${paddock.id}: ${error.message}`);
        }
      }
    }

    // Eliminar los collares asociados (soft delete)
    if (establishment.collars && establishment.collars.length > 0) {
      for (const collar of establishment.collars) {
        try {
          await this.collarService.remove(collar.id);
        } catch (error) {
          Logger.warn(`Error al eliminar collar ${collar.id}: ${error.message}`);
        }
      }
    }

    // La relación con breeds (ManyToMany) se eliminará automáticamente al eliminar el establishment
    // No necesitamos eliminarlas manualmente ya que son entidades independientes

    // Remover el establishmentId de todos los usuarios en Cognito
    try {
      const result = await this.userManagementService.removeEstablishmentFromAllUsers(id);
      Logger.log(`Establishment ${id} removed from ${result.affectedUsers} user(s) in Cognito`);
    } catch (error) {
      Logger.error(`Error removing establishment ${id} from users in Cognito: ${error.message}`, error.stack);
      // Continuamos con la eliminación aunque falle la actualización de usuarios
      // pero logueamos el error completo para debugging
    }

    // Finalmente, eliminar el establecimiento (soft delete)
    const result = await this.establishmentRepository.softDelete({ id });

    if (!result.affected) {
      throw new Error('No se pudo borrar el establecimiento');
    }

    return true;
  }
}
