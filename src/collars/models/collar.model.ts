import { CollarEntity } from '../entities/collar.entity';
import { collarBaseSchema } from '../schema/collar.schema';
import { ToDto } from 'src/commons/decorators/to-dto.decorator';

@ToDto(collarBaseSchema)
export class Collar extends CollarEntity {}
