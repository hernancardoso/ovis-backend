import { Injectable } from '@nestjs/common';
import { CreateSheepDto } from './dto/create-sheep.dto';
import { UpdateSheepDto } from './dto/update-sheep.dto';

@Injectable()
export class SheepService {
  create(createSheepDto: CreateSheepDto) {
    return 'This action adds a new sheep';
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
