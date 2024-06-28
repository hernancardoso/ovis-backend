import { Injectable, Logger } from '@nestjs/common';
import { CreateSheepCollarDto } from './dto/create-sheep-collar.dto';
import { UpdateSheepCollarDto } from './dto/update-sheep-collar.dto';
import { SheepCollarEntity } from './entities/sheep-collar.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { EstablishmentsService } from 'src/establishments/establishments.service';
import { Repository, Not, IsNull } from 'typeorm';
import { CollarDto } from 'src/collars/dto/collar.dto';
import { AssignCollarToSheepDto } from './dto/assign-collar-to-sheep.dto';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';

@Injectable()
export class SheepCollarService {
  constructor(
    @InjectRepository(SheepCollarEntity)
    private sheepCollarRepository: Repository<SheepCollarEntity>
  ) {}

  private async findAssignedSheep(sheepId: SheepEntity['id']) {
    return await this.sheepCollarRepository.findOne({
      where: { sheep: { id: sheepId }, assignedUntil: IsNull() },
      order: { id: 'DESC' },
    });
  }

  private async findAssignedCollar(collarId: SheepEntity['id']) {
    return await this.sheepCollarRepository.find()[0];
    // return await this.sheepCollarRepository.findOne({
    //   where: { collar: { id: collarId }, assignedUntil: IsNull() },
    //   order: { id: 'DESC' },
    // });
  }

  async assign(assignCollarToSheepDto: AssignCollarToSheepDto) {
    if (!assignCollarToSheepDto.assignedFrom) assignCollarToSheepDto.assignedFrom = new Date();
    const { collarId, sheepId, assignedFrom } = assignCollarToSheepDto;

    // Check that the collar or the sheep is not in use
    const collar = (await this.findAssignedCollar(collarId))?.collar;
    console.log(collar);
    const sheep = (await this.findAssignedSheep(sheepId))?.sheep;

    if (collar) throw new Error(`The collar ${collar.id} is already in use`);
    if (sheep) throw new Error(`The sheep ${sheep.id} is already in use`);
    Logger.warn(`Params ${collarId}, ${sheepId}`, 'WARNING PARAMETERS');

    const association = this.sheepCollarRepository.create(assignCollarToSheepDto);

    try {
      await this.sheepCollarRepository.save(association);
    } catch (e) {
      Logger.warn(e, 'error');
      console.log(e, typeof e);
      throw new Error('Not killing things');
    }
  }

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
