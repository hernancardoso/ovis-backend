import { CollarEntity } from '../entities/collar.entity';
import { CollarDto } from '../dto/collar.dto';
import { z } from 'zod';
import { collarBaseSchema } from '../schema/collar.schema';
import { ToDto } from 'src/commons/decorators/to-dto.decorator';
import { BaseModel } from 'src/commons/models/base-model';

@ToDto(collarBaseSchema)
export class Collar extends BaseModel<CollarEntity, CollarDto> {
  protected schema = collarBaseSchema;
}
