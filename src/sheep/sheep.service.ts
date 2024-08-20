import { forwardRef, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateSheepDto } from './dto/create-sheep.dto';
import { UpdateSheepDto } from './dto/update-sheep.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { SheepEntity } from './entities/sheep.entity';
import { Repository } from 'typeorm';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { PaddocksService } from 'src/paddocks/paddocks.service';

@Injectable()
export class SheepService {
  constructor(
    @InjectRepository(SheepEntity)
    private sheepRepository: Repository<SheepEntity>,
    @Inject(forwardRef(() => PaddocksService))
    private paddocksService: PaddocksService
  ) {}

  async create(establishmentId: EstablishmentEntity['id'], createSheepDto: CreateSheepDto) {
    const sheep = this.sheepRepository.create(createSheepDto);

    //const paddock = await this.paddocksService.findOne(createSheepDto.paddockId);

    //console.log(sheep);
    //if (paddock.establishmentId !== establishmentId)
    //  throw new UnauthorizedException('El paddock no pertenece al establecimiento');

    return this.sheepRepository.save(sheep);
  }

  async findByIdOrFail(id: string, relations: ('paddock' | 'collar')[] = []) {
    if (!id) throw new Error('La id del collar no puede ser vacía');
    return await this.sheepRepository.findOneOrFail({ where: { id: id ?? '' }, relations });
  }

  async findAll(establishmentId: EstablishmentEntity['id']) {
    return (await this.paddocksService.findAll(establishmentId)).flatMap((paddock) => paddock.sheep).filter(Boolean);
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
