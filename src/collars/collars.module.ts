import { Module, forwardRef } from '@nestjs/common';
import { CollarsService } from './collars.service';
import { CollarsController } from './collars.controller';
import { CollarEntity } from './entities/collar.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstablishmentsModule } from 'src/establishments/establishments.module';

@Module({
  imports: [TypeOrmModule.forFeature([CollarEntity]), forwardRef(() => EstablishmentsModule)],
  controllers: [CollarsController],
  providers: [CollarsService],
  exports: [CollarsService]

})
export class CollarsModule {}
