import { Module, forwardRef } from '@nestjs/common';
import { CollarsService } from './collars.service';
import { CollarsController } from './collars.controller';
import { CollarEntity } from './entities/collar.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstablishmentsModule } from 'src/establishments/establishments.module';
import { SheepCollarModule } from 'src/sheep-collar/sheep-collar.module';
import { DynamoDBCollarService } from './services/dynamodb-collar.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CollarEntity]),
    forwardRef(() => EstablishmentsModule),
    forwardRef(() => SheepCollarModule),
  ],
  controllers: [CollarsController],
  providers: [CollarsService, DynamoDBCollarService],
  exports: [CollarsService, DynamoDBCollarService],
})
export class CollarsModule {}
