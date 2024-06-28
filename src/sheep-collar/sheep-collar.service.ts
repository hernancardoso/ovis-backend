import { Injectable } from '@nestjs/common';
import { CreateSheepCollarDto } from './dto/create-sheep-collar.dto';
import { UpdateSheepCollarDto } from './dto/update-sheep-collar.dto';

@Injectable()
export class SheepCollarService {
  create(createSheepCollarDto: CreateSheepCollarDto) {
    return 'This action adds a new sheepCollar';
  }

  findAll() {
    return `This action returns all sheepCollar`;
  }

  findOne(id: number) {
    return `This action returns a #${id} sheepCollar`;
  }

  update(id: number, updateSheepCollarDto: UpdateSheepCollarDto) {
    return `This action updates a #${id} sheepCollar`;
  }

  remove(id: number) {
    return `This action removes a #${id} sheepCollar`;
  }
}
