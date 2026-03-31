import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShadowParamEntity } from './entities/shadow-param.entity';
import { CreateShadowParamDto } from './dto/create-shadow-param.dto';
import { UpdateShadowParamDto } from './dto/update-shadow-param.dto';

@Injectable()
export class ShadowParamsService {
  constructor(
    @InjectRepository(ShadowParamEntity)
    private readonly repo: Repository<ShadowParamEntity>,
  ) {}

  async findAll(): Promise<ShadowParamEntity[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }

  async create(dto: CreateShadowParamDto): Promise<ShadowParamEntity> {
    const existing = await this.repo.findOne({ where: { key: dto.key } });
    if (existing) {
      throw new BadRequestException(`El parámetro "${dto.key}" ya existe`);
    }

    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateShadowParamDto): Promise<ShadowParamEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Shadow param con id ${id} no encontrado`);
    }

    if (dto.type !== undefined) entity.type = dto.type;
    if (dto.description !== undefined) entity.description = dto.description || undefined;

    return this.repo.save(entity);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Shadow param con id ${id} no encontrado`);
    }

    await this.repo.softRemove(entity);
    return { ok: true };
  }
}
