import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { CollarsService } from './collars.service';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { User } from 'src/commons/decorators/user.decorator';
import { CollarFilterDto } from './dto/collar-filter.dto';
import { GetInitialFilterDto } from './dto/get-initial-info.dto';
import { IotShadowService } from './services/iot-shadow.service';
import { UpdateShadowDto } from './dto/update-shadow.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AdminGuard } from 'src/commons/guards/admin.guard';
import { AdminRoute } from 'src/commons/decorators/admin-route.decorator';

@Controller('collars')
export class CollarsController {
  private readonly logger = new Logger(CollarsController.name);

  constructor(
    private readonly collarsService: CollarsService,
    private readonly iotShadowService: IotShadowService
  ) {}

  @Post()
  create(
    @User('establishmentId') establishmentId: EstablishmentEntity['id'],
    @Body() createCollarDto: CreateCollarDto
  ) {
    return this.collarsService.create(establishmentId, createCollarDto);
  }

  @Get()
  findAll(
    @User('establishmentId') establishmentId: EstablishmentEntity['id'],
    @Query() filter?: CollarFilterDto
  ) {
    return this.collarsService.findAll(establishmentId, filter);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @AdminRoute()
  findAllAcrossEstablishments(@Query() filter?: CollarFilterDto) {
    return this.collarsService.findAllAcrossEstablishments(filter);
  }

  @Get(':imei/info')
  getInitialInfo(@Param('imei') imei: string, @Query() params: GetInitialFilterDto) {
    const { limit } = params;
    return this.collarsService.getInitialInfo(Number(imei), limit);
  }

  @Get(':imei/shadow')
  async getShadow(@Param('imei') imei: string, @Query('shadowName') shadowName?: string) {
    // Nordic asset-tracker-v2 uses the IMEI as the Thing Name in most setups.
    // We don't use establishment scoping here by request.
    const thingName = String(imei);
    return this.iotShadowService.getThingShadow({ thingName, shadowName });
  }

  @Patch(':imei/shadow')
  async updateShadow(@Param('imei') imei: string, @Body() body: UpdateShadowDto) {
    this.logger.log(`PATCH shadow requested for IMEI=${imei}`);
    const thingName = String(imei);
    return this.iotShadowService.updateThingShadow({
      thingName,
      shadowName: body.shadowName,
      desired: body.desired ?? {},
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.collarsService.findOne(id);
  }

  @Patch(':id')
  update(
    @User('establishmentId') establishmentId: EstablishmentEntity['id'],
    @Param('id') id: string,
    @Body() updateCollarDto: UpdateCollarDto
  ) {
    return this.collarsService.update(establishmentId, id, updateCollarDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.collarsService.remove(id);
  }
}
