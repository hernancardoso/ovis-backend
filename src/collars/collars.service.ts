import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';
import { CollarEntity } from './entities/collar.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EstablishmentsService } from 'src/establishments/establishments.service';

@Injectable()
export class CollarsService {
  constructor(
    @InjectRepository(CollarEntity)
    private collarRepository: Repository<CollarEntity>,
    @Inject(forwardRef(() => EstablishmentsService))
    private establishmentService: EstablishmentsService,
  ) {}

  async create(createCollarDto: CreateCollarDto) {
    const collar = this.collarRepository.create(createCollarDto);

    const establishment = await this.establishmentService.findById(
      createCollarDto.establishmentId,
    );
    collar.establishment = establishment;

    return this.collarRepository.save(collar);
  }

  async update(id: string, updateCollarDto: UpdateCollarDto) {
    const collar = await this.findByIdOrFail(id);
    collar.name = updateCollarDto.name ?? collar.name;

    if (
      updateCollarDto.establishmentId &&
      collar.establishment.id !== updateCollarDto.establishmentId
    )
      collar.establishment = await this.establishmentService.findById(
        updateCollarDto.establishmentId,
      );

    return this.collarRepository.save(collar);
  }

  findAll() {
    return `This action returns all collars`;
  }

  findOne(id: number) {
    return `This action returns a #${id} collar`;
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
