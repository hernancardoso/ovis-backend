import { Injectable, Logger } from '@nestjs/common';
import { CreateBreedDto } from './dto/create-breed.dto';
import { UpdateBreedDto } from './dto/update-breed.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { BreedsEntity } from './entities/breed.entity';
import { Repository, In } from 'typeorm';

@Injectable()
export class BreedsService {
  constructor(
    @InjectRepository(BreedsEntity)
    private readonly breedsRepository: Repository<BreedsEntity>
  ) {}

  async create(createBreedDto: CreateBreedDto) {
    try {
      const breed = this.breedsRepository.create(createBreedDto);
      return await this.breedsRepository.save(breed);
    } catch (e) {
      Logger.error(e);
    }
  }

  async findAll() {
    return await this.breedsRepository.find();
  }

  findOne(id: number) {
    return `This action returns a #${id} breed`;
  }

  async update(id: number, updateBreedDto: UpdateBreedDto) {
    try {
      const oldBreed = await this.breedsRepository.findOneBy({ id });
      if (!oldBreed) throw new Error('Breed not found');
      const newBreed = this.breedsRepository.merge(oldBreed, updateBreedDto);
      return await this.breedsRepository.save(newBreed);
    } catch (e) {
      Logger.error(e);
    }
  }

  async remove(id: number) {
    try {
      const breed = await this.breedsRepository.findOneBy({ id });
      if (!breed) {
        throw new Error('Breed not found');
      }
      await this.breedsRepository.remove(breed);
      return { success: true };
    } catch (e) {
      Logger.error(e);
      throw e;
    }
  }

  async find(ids: number): Promise<BreedsEntity>;
  async find(ids: number[]): Promise<BreedsEntity[]>;

  async find(ids: number | number[]): Promise<BreedsEntity | BreedsEntity[]> {
    return await this.breedsRepository.find({ where: { id: Array.isArray(ids) ? In(ids) : ids } });
  }
}
