import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
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

@Injectable()
export class EstablishmentsService {
  constructor(
    @InjectRepository(EstablishmentEntity)
    private establishmentRepository: Repository<EstablishmentEntity>,
    @Inject(forwardRef(() => CollarsService))
    private collarService: CollarsService,
    private readonly breedsService: BreedsService
  ) {}

  async create(createEstablishmentDto: CreateEstablishmentDto): Promise<EstablishmentEntity> {
    const establishment = this.establishmentRepository.create(createEstablishmentDto);

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
    return await this.establishmentRepository.findOneOrFail({ where: { id: id ?? '' }, relations });
  }

  async findAll() {
    return this.establishmentRepository.find({
      relations: ['breeds', 'collars', 'paddocks'],
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

  remove(id: number) {
    return `This action removes a #${id} establishment`;
  }
}
