import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { GetReportDTO } from './dto/get-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(':collarImei')
  find(@Param('collarImei') collarImei: string, @Query() params: GetReportDTO) {
    return this.reportsService.find(+collarImei, params);
  }
}
