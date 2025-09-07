import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CreatePaddockDto } from './dto/create-paddock.dto';
import { UpdatePaddockDto } from './dto/update-paddock.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PaddockEntity } from './entities/paddock.entity';
import { Repository, FindOptionsRelations } from 'typeorm';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { SheepService } from 'src/sheep/sheep.service';
import { EitherOr } from 'src/commons/types/EitherOr.type';

@Injectable()
export class PaddocksService {
  constructor(
    @InjectRepository(PaddockEntity)
    private readonly paddockRepository: Repository<PaddockEntity>,
    @Inject(forwardRef(() => SheepService))
    private sheepService: SheepService
  ) {}

  async create(establishmentId: EstablishmentEntity['id'], createPaddockDto: CreatePaddockDto) {
    const paddock = this.paddockRepository.create(createPaddockDto);
    paddock.establishmentId = establishmentId;

    //if (createPaddockDto.sheepIds && createPaddockDto.sheepIds.length > 0) {
    // try {
    //   const sheep = await this.sheepService.findByIds(createPaddockDto.sheepIds);
    //   paddock.sheep = sheep;
    // } catch (e) {
    //   throw new Error('Error al buscar las ovejas');
    // }
    //}
    // paddock.sheep = await this.sheepService.findByIds(createPaddockDto.sheepIds);

    return await this.paddockRepository.save(paddock);
  }

  async findAll(establishmentId: EstablishmentEntity['id']) {
    return this.paddockRepository.find({ where: { establishmentId } });
  }

  async getSheepFrom({
    establishmentId,
    paddockId,
  }: EitherOr<{ establishmentId: string }, { paddockId: string }>) {
    const paddocks = await this.paddockRepository.find({
      where: [{ establishmentId }, { id: paddockId }],
      relations: ['sheep'],
    });
    return paddocks.flatMap((paddock) => paddock.sheep);
  }

  async getSheepIdsFrom({
    establishmentId,
    paddockId,
  }: EitherOr<{ establishmentId: string }, { paddockId: string }>) {
    const paddocks = await this.paddockRepository.find({
      where: [{ establishmentId }, { id: paddockId }],
      loadRelationIds: { relations: ['sheep'] },
    });
    const sheepIds = paddocks.flatMap((paddock) => paddock.sheep) as unknown as string[];

    return sheepIds;
  }

  async findOne(id: string) {
    return this.paddockRepository.findOneOrFail({ where: { id }, relations: ['sheep'] });
  }

  async update(id: PaddockEntity['id'], updatePaddockDto: UpdatePaddockDto) {
    const paddock = await this.paddockRepository.findOneByOrFail({ id });

    if (paddock && updatePaddockDto.name) {
      paddock.name = updatePaddockDto.name;
    }

    if (updatePaddockDto.sheepIds) {
      try {
        paddock.sheep = await this.sheepService.findByIds(updatePaddockDto.sheepIds);
      } catch (e) {
        throw new Error('Error al buscar las ovejas');
      }
    }

    return await this.paddockRepository.save(paddock);
  }

  async remove(id: string) {
    const paddock = await this.paddockRepository.findOneOrFail({
      where: { id },
      relations: ['sheep'],
    });
    if (paddock.sheep && paddock.sheep.length > 0) {
      throw new Error('No se puede borrar el corral porque tiene ovejas asociadas');
    }

    const result = await this.paddockRepository.softDelete({ id });

    return Boolean(result.affected);
  }
}
