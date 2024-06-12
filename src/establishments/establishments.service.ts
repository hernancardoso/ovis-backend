import { Injectable, Logger } from '@nestjs/common';
import { CreateEstablishmentDto } from './dto/create-establishment.dto';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto';
import { EstablishmentEntity } from './entities/establishment.entity';
import { InjectRepository} from '@nestjs/typeorm'
import { Repository, In } from 'typeorm';
import { CollarEntity } from 'src/collars/entities/collar.entity';


@Injectable()
export class EstablishmentsService {
  private logger = new Logger();
  
  constructor(
    @InjectRepository(EstablishmentEntity)
    @InjectRepository(CollarEntity)
    private establishmentRepository: Repository<EstablishmentEntity>,
    private collarRepository: Repository<CollarEntity>
  ) {}

  async create(createEstablishmentDto: CreateEstablishmentDto): Promise<EstablishmentEntity> {
    const establishment = this.establishmentRepository.create(createEstablishmentDto)
    
    
    if (createEstablishmentDto.collarIds && createEstablishmentDto.collarIds.length > 0) {
      const collars = await this.collarRepository.findBy({id: In(createEstablishmentDto.collarIds)})

      if(collars.length !== createEstablishmentDto.collarIds.length) throw new Error('One or more collar IDs are invalid');
      
      establishment.collars = collars;
    }

    return this.establishmentRepository.save(establishment);

  
  }

  findAll() {
    return `This action returns all establishments`;
  }


  findOne(id: number) {
    return `This action returns a #${id} establishment`;
  }

  update(id: number, updateEstablishmentDto: UpdateEstablishmentDto) {
    return `This action updates a #${id} establishment`;
  }

  remove(id: number) {
    return `This action removes a #${id} establishment`;
  }
}