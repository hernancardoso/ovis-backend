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
import { CollarFilterDto } from './dto/collar-filter.dto';
import { AssignationStatus } from 'src/commons/enums/AssignationStatus.enum';

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
    const updatedCollar = this.collarRepository.merge(collar, updateCollarDto);
    return this.collarRepository.save(updatedCollar);
  }

  async findAll(establishmentId: EstablishmentEntity['id'], filter?: CollarFilterDto) {
    const collars = await this.collarRepository.findBy({ establishmentId });
    console.log('bueno', filter);
    if (filter?.status) {
      console.log('searching with filters');
      return collars.filter((collar) => {
        const isAssociated = Boolean(collar.sheepId);
        return (
          (filter.status === AssignationStatus.ASSIGNED && isAssociated) ||
          (filter.status !== AssignationStatus.ASSIGNED && !isAssociated)
        );
      });
    }

    return collars;
  }

  async updateSheep(collarId: string, sheepId: string | null) {
    const collar = await this.collarRepository.findOneBy({ id: collarId });
    if (collar) {
      collar.sheepId = sheepId;
      return this.collarRepository.save(collar);
    }
  }

  async findOne(id: string) {
    return this.collarRepository.findOne({
      where: { id },
      // loadRelationIds: {
      //   relations: ['establishment'],
      //   disableMixedMap: true,
      // },
      relations: ['sheep'],
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
