import { Injectable } from '@nestjs/common';
import { CreatePaddockDto } from './dto/create-paddock.dto';
import { UpdatePaddockDto } from './dto/update-paddock.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PaddockEntity } from './entities/paddock.entity';
import { Repository } from 'typeorm';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { UserEstablishmentId } from 'src/commons/decorators/user-establishment-id.decorator';

@Injectable()
export class PaddocksService {
  constructor(
    @InjectRepository(PaddockEntity)
    private readonly paddockRepository: Repository<PaddockEntity>
  ) {}

  async create(establishmentId: EstablishmentEntity['id'], createPaddockDto: CreatePaddockDto) {
    const paddock = this.paddockRepository.create(createPaddockDto);
    paddock.establishmentId = establishmentId;

    return await this.paddockRepository.save(paddock);
  }

  async findAll(establishmentId: EstablishmentEntity['id']) {
    return this.paddockRepository.findBy({ establishmentId });
  }

  async findOne(id: string) {
    return this.paddockRepository.findOneByOrFail({ id });
  }

  update(id: number, updatePaddockDto: UpdatePaddockDto) {
    return `This action updates a #${id} paddock`;
  }

  remove(id: number) {
    return `This action removes a #${id} paddock`;
  }
}
