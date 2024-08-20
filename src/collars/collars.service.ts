import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';
import { CollarEntity } from './entities/collar.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EstablishmentsService } from 'src/establishments/establishments.service';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { SheepCollarEntity } from 'src/sheep-collar/entities/sheep-collar.entity';
import { SheepCollarService } from 'src/sheep-collar/sheep-collar.service';

@Injectable()
export class CollarsService {
  constructor(
    @InjectRepository(CollarEntity)
    private collarRepository: Repository<CollarEntity>,
    @Inject(forwardRef(() => SheepCollarService))
    private sheepCollarService: SheepCollarService
  ) {}

  async create(establishmentId: EstablishmentEntity['id'], createCollarDto: CreateCollarDto) {
    const { sheepId, ...collarData } = createCollarDto;
    const collar = this.collarRepository.create(collarData);
    collar.establishmentId = establishmentId;

    const savedCollar = await this.collarRepository.save(collar);
    if (sheepId) this.sheepCollarService.assign({ collarId: savedCollar.id, sheepId });
    return savedCollar;
  }

  async update(id: string, updateCollarDto: UpdateCollarDto) {
    const collar = await this.findByIdOrFail(id);
    collar.name = updateCollarDto.name ?? collar.name;

    return await this.collarRepository.save(collar);
  }

  findAll(establishmentId: EstablishmentEntity['id']) {
    //TODO
    return this.collarRepository.findBy({ establishmentId });
  }

  async findAllUnassigned(establishmentId: EstablishmentEntity['id']) {
    const collars = await this.collarRepository.find({ where: { establishmentId }, relations: ['sheep'] });
    // Sort the sheep collar association to get the first result, this should be the last association (0 position is the last insertion)
    // If both assignedFrom and assignedUntil values are filled OR no entry was found then the collar is unassigned
    collars.forEach((collar) =>
      collar.sheep.sort((sheep_collar_assoc1, sheep_collar_assoc2) => sheep_collar_assoc2.id - sheep_collar_assoc1.id)
    );

    return collars.filter((collar) => collar.sheep.length === 0 || collar.sheep[0].assignedUntil);
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
