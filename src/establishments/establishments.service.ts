import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { CreateEstablishmentDto } from './dto/create-establishment.dto';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto';
import { EstablishmentEntity } from './entities/establishment.entity';
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In } from 'typeorm';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { CollarsService } from 'src/collars/collars.service';


@Injectable()
export class EstablishmentsService {
  private logger = new Logger();

  constructor(
    @InjectRepository(EstablishmentEntity)
    private establishmentRepository: Repository<EstablishmentEntity>,
    @Inject(forwardRef(() => CollarsService))
    private collarService: CollarsService
  ) { }


  async create(createEstablishmentDto: CreateEstablishmentDto): Promise<EstablishmentEntity> {
    const establishment = this.establishmentRepository.create(createEstablishmentDto)

    if (createEstablishmentDto?.collarIds.length) {
      const collars = await this.collarService.findByIds(createEstablishmentDto.collarIds)

      if (collars.length !== createEstablishmentDto.collarIds.length) throw new Error('One or more collar IDs are invalid');

      establishment.collars = collars;
    }

    return this.establishmentRepository.save(establishment);
  }

  async update(id: string, updateEstablishmentDto: UpdateEstablishmentDto) {
    const establishment = await this.findById(id)
    establishment.name = updateEstablishmentDto.name ?? establishment.name

    if(updateEstablishmentDto.collarIds?.length) {
      const newCollars = await this.collarService.findByIds(updateEstablishmentDto.collarIds)
      if (newCollars.length !== updateEstablishmentDto.collarIds.length) throw new Error('One or more collar IDs are invalid');

      establishment.collars = newCollars
    }

    return this.establishmentRepository.save(establishment)
  }

  findAll() {
    return `This action returns all establishments`;
  }


  async findById(id: string){
    if (!id) throw new Error("La id del establecimiento no puede ser vacía")
    return this.establishmentRepository.findOneByOrFail({id})
  }
  
  async findOne(id: string) {
    return `This action returns a #establishments`;
  }



  remove(id: number) {
    return `This action removes a #${id} establishment`;
  }
}