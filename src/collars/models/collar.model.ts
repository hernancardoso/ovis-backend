import { CollarEntity } from '../entities/collar.entity';
import { CollarDto } from '../dto/collar.dto';
import { collarBaseSchema } from '../schemas/collar.schema';
import { BaseModel } from 'src/commons/models/base-model';

export class Collar extends BaseModel<CollarEntity, CollarDto> {
  protected schema = collarBaseSchema;
}
