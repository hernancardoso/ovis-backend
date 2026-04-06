import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { AnalyticsEventsService } from './analytics-events.service';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';

@Controller('analytics-events')
export class AnalyticsEventsController {
  constructor(private readonly analyticsService: AnalyticsEventsService) {}

  @Post()
  async createEvent(@Body() dto: CreateAnalyticsEventDto) {
    return this.analyticsService.create(dto);
  }

  @Get()
  async getEvents(@Query('type') type?: string) {
    return this.analyticsService.findAll(type);
  }
}
