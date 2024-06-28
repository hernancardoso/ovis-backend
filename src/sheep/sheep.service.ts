import { Injectable } from '@nestjs/common';
import { CreateSheepDto } from './dto/create-sheep.dto';
import { UpdateSheepDto } from './dto/update-sheep.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { SheepEntity } from './entities/sheep.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SheepService {
  constructor(
    @InjectRepository(SheepEntity)
    private sheepEntity: Repository<SheepEntity>
  ) {}
  async create(createSheepDto: CreateSheepDto) {
    await this.sheepEntity.save(this.sheepEntity.create(createSheepDto));
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
