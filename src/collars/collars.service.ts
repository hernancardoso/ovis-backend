import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';
import { CollarEntity } from './entities/collar.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EstablishmentsService } from 'src/establishments/establishments.service';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';

@Injectable()
export class CollarsService {
  constructor(
    @InjectRepository(CollarEntity)
    private collarRepository: Repository<CollarEntity>,

    @Inject(forwardRef(() => EstablishmentsService))
    private establishmentService: EstablishmentsService
  ) {}

  async create(establishmentId: EstablishmentEntity['id'], createCollarDto: CreateCollarDto) {
    const collar = this.collarRepository.create(createCollarDto);
    collar.establishmentId = establishmentId;

    return this.collarRepository.save(collar);
  }

  async update(id: string, updateCollarDto: UpdateCollarDto) {
    const collar = await this.findByIdOrFail(id);
    collar.name = updateCollarDto.name ?? collar.name;

    return await this.collarRepository.save(collar);
  }

  findAll() {
    return `This action returns all collars`;
  }

  async findOne(id: string) {
    return this.collarRepository.findOne({
      where: { id },
      // loadRelationIds: {
      //   relations: ['establishment'],
      //   disableMixedMap: true,
      // },
      relations: ['establishment'],
    });
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
