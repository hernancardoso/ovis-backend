import { BaseModel } from 'src/commons/models/base-model';
import { EstablishmentEntity } from '../entities/establishment.entity';
import { EstablishmentDto } from '../dto/establishment.dto';
import { establishmentSchema } from '../schemas/establishment.schema';

export class Collar extends BaseModel<EstablishmentEntity, EstablishmentDto> {
  protected schema = establishmentSchema;
}
