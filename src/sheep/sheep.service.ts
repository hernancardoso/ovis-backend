import { forwardRef, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateSheepDto } from './dto/create-sheep.dto';
import { UpdateSheepDto } from './dto/update-sheep.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { SheepEntity } from './entities/sheep.entity';
import { Repository } from 'typeorm';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { PaddocksService } from 'src/paddocks/paddocks.service';
import { SheepCollarService } from 'src/sheep-collar/sheep-collar.service';
import { SheepFilterDto } from './dto/filter-sheep-dto';
import { AssignationStatus } from 'src/commons/enums/AssignationStatus.enum';

@Injectable()
export class SheepService {
  constructor(
    @InjectRepository(SheepEntity)
    private sheepRepository: Repository<SheepEntity>,
    @Inject(forwardRef(() => PaddocksService))
    private paddocksService: PaddocksService,
    @Inject(forwardRef(() => SheepCollarService))
    private sheepCollarService: SheepCollarService
  ) {}

  async create(establishmentId: EstablishmentEntity['id'], createSheepDto: CreateSheepDto) {
    try {
      const sheep = await this.sheepRepository.save(this.sheepRepository.create(createSheepDto));
      if (createSheepDto.collarId) {
        try {
          await this.sheepCollarService.assign({ sheepId: sheep.id, collarId: createSheepDto.collarId });
        } catch (e) {
          console.log('El collar seleccionado no está disponible');
        }
      }
      return sheep;
    } catch (e) {
      throw new Error('Error al crear la oveja, intente nuevamente - collarId o paddockId incorrectos');
    }
  }

  async findByIdOrFail(id: string, relations: ('paddock' | 'collar')[] = []) {
    if (!id) throw new Error('La id del collar no puede ser vacía');
    return await this.sheepRepository.findOneOrFail({ where: { id: id ?? '' }, relations });
  }

  async findAll(establishmentId: EstablishmentEntity['id'], filter?: SheepFilterDto) {
    const sheep = await this.paddocksService.getSheepFrom({ establishmentId });

    if (filter?.status) {
      console.log('searching with filters');
      return sheep.filter((sheep) => {
        const isAssociated = Boolean(sheep.collarId);
        return (
          (filter.status === AssignationStatus.ASSIGNED && isAssociated) ||
          (filter.status !== AssignationStatus.ASSIGNED && !isAssociated)
        );
      });
    }

    return sheep;
  }

  async findByIds(ids: string[]): Promise<SheepEntity[]> {
    console.log('llegue');

    return this.sheepRepository.findBy({ id: In(ids) });
  }

  async findOne(id: SheepEntity['id']) {
    return this.sheepRepository.findOneByOrFail({ id });
  }

  async update(establishmentId: EstablishmentEntity['id'], id: string, updateSheepDto: UpdateSheepDto) {
    const sheep = await this.findByIdOrFail(id, ['paddock']);
    if (sheep.paddock.establishmentId !== establishmentId) {
      throw new UnauthorizedException('La oveja no pertenece al establecimiento');
    }

    const updatedSheep = this.sheepRepository.merge(sheep, updateSheepDto);
    try {
      return await this.sheepRepository.save(updatedSheep);
    } catch (e) {
      throw new Error('Error al actualizar la oveja');
    }
  }

  remove(id: number) {
    return `This action removes a #${id} sheep`;
  }
}
function In(ids: string[]): string | import('typeorm').FindOperator<string> | undefined {
  throw new Error('Function not implemented.');
}
