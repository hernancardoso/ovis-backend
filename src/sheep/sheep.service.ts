import { Injectable } from '@nestjs/common';
import { CreateSheepDto } from './dto/create-sheep.dto';
import { UpdateSheepDto } from './dto/update-sheep.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { SheepEntity } from './entities/sheep.entity';
import { Repository } from 'typeorm';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';

@Injectable()
export class SheepService {
  constructor(
    @InjectRepository(SheepEntity)
    private sheepRepository: Repository<SheepEntity>
  ) {}

  async create(establishmentId: EstablishmentEntity['id'], createSheepDto: CreateSheepDto) {
    const sheep = this.sheepRepository.create({ establishmentId, ...createSheepDto });

    // const establishment = await this.establishmentService.findById(createCollarDto.establishmentId);
    // collar.establishment = establishment;

    return this.sheepRepository.save(sheep);
  }

  findByIdOrFail(id: string) {
    if (!id) throw new Error('La id del collar no puede ser vacía');
    return this.sheepRepository.findOneByOrFail({ id: id ?? '' });
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
