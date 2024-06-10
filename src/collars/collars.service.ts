import { Injectable } from '@nestjs/common';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';

@Injectable()
export class CollarsService {
  create(createCollarDto: CreateCollarDto) {
    return 'This action adds a new collar';
  }

  findAll() {
    return `This action returns all collars`;
  }

  findOne(id: number) {
    return `This action returns a #${id} collar`;
  }

  update(id: number, updateCollarDto: UpdateCollarDto) {
    return `This action updates a #${id} collar`;
  }

  remove(id: number) {
    return `This action removes a #${id} collar`;
  }
}
