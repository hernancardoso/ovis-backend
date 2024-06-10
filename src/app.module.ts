import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CollarsModule } from './collars/collars.module';

@Module({
  imports: [CollarsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
