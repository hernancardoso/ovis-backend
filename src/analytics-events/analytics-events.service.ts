import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { Repository } from 'typeorm';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';

@Injectable()
export class AnalyticsEventsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsRepository: Repository<AnalyticsEvent>,
  ) {}

  async create(dto: CreateAnalyticsEventDto): Promise<AnalyticsEvent> {
    const event = this.analyticsRepository.create({
      ...dto,
      imei: dto.imei ? String(dto.imei) : null,
    });
    return this.analyticsRepository.save(event);
  }

  async findAll(type?: string): Promise<AnalyticsEvent[]> {
    const query = this.analyticsRepository.createQueryBuilder('event');
    
    if (type) {
      query.where('event.type = :type', { type });
    }
    
    // Mostramos los mas recientes primero, limitando a los ultimos 50 para no sobrecargar
    query.orderBy('event.createdAt', 'DESC').limit(50);
    
    return query.getMany();
  }
}
