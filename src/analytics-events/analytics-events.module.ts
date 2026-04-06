import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { AnalyticsEventsService } from './analytics-events.service';
import { AnalyticsEventsController } from './analytics-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEvent])],
  controllers: [AnalyticsEventsController],
  providers: [AnalyticsEventsService],
  exports: [AnalyticsEventsService],
})
export class AnalyticsEventsModule {}
