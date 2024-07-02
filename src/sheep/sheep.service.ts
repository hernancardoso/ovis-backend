import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateSheepDto } from './dto/create-sheep.dto';
import { UpdateSheepDto } from './dto/update-sheep.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { SheepEntity } from './entities/sheep.entity';
import { Repository } from 'typeorm';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { EstablishmentsService } from 'src/establishments/establishments.service';
import { PaddocksService } from 'src/paddocks/paddocks.service';

@Injectable()
export class SheepService {
  constructor(
    @InjectRepository(SheepEntity)
    private sheepRepository: Repository<SheepEntity>,
    private paddocksService: PaddocksService
  ) {}

  async create(establishmentId: EstablishmentEntity['id'], createSheepDto: CreateSheepDto) {
    const sheep = this.sheepRepository.create(createSheepDto);

    const paddock = await this.paddocksService.findOne(createSheepDto.paddockId);
    if (paddock.establishmentId !== establishmentId)
      throw new UnauthorizedException('El paddock no pertenece al establecimiento');

    return this.sheepRepository.save(sheep);
  }

  findByIdOrFail(id: string, relations: ('paddock' | 'collar')[] = []) {
    if (!id) throw new Error('La id del collar no puede ser vacía');
    return this.sheepRepository.findOneOrFail({ where: { id: id ?? '' }, relations });
  }

  findAll() {
    return `This action returns all sheep`;
  }

  findOne(id: number) {
    return `This action returns a #${id} sheep`;
  }

  update(id: number, updateSheepDto: UpdateSheepDto) {
    return `This action updates a #${id} sheep`;
  }

  remove(id: number) {
    return `This action removes a #${id} sheep`;
  }
}
