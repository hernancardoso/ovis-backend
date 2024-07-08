import { Controller, Get, Post, Body, Patch, Param, Delete, Put } from '@nestjs/common';
import { EstablishmentsService } from './establishments.service';
import { CreateEstablishmentDto } from './dto/create-establishment.dto';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto';
import { EstablishmentEntity } from './entities/establishment.entity';
import { UpdateBreedsDto } from './dto/update-breeds.dto';
import { UserEstablishmentId } from 'src/commons/decorators/user-establishment-id.decorator';

@Controller('establishments')
export class EstablishmentsController {
  constructor(private readonly establishmentsService: EstablishmentsService) {}

  @Get(':id/breeds')
  listBreeds(@Param('id') establishmentId: EstablishmentEntity['id']) {
    return this.establishmentsService.listBreeds(establishmentId);
  }

  @Put(':id/breeds')
  updateBreeds(@Param('id') establishmentId: EstablishmentEntity['id'], @Body() updateBreedsDto: UpdateBreedsDto) {
    return this.establishmentsService.updateBreeds(establishmentId, updateBreedsDto);
  }

  @Post()
  create(@Body() createEstablishmentDto: CreateEstablishmentDto) {
    return this.establishmentsService.create(createEstablishmentDto);
  }

  @Get('all')
  findAll() {
    return this.establishmentsService.findAll();
  }

  @Get()
  findOne(@UserEstablishmentId() establishmentId: EstablishmentEntity['id']) {
    console.log('this aws called');
    return this.establishmentsService.findByIdOrFail(establishmentId, ['breeds', 'paddocks', 'collars']);
  }

  @Get(':id/collars')
  getCollars(@Param('id') id: string) {
    return this.establishmentsService.getCollars(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEstablishmentDto: UpdateEstablishmentDto) {
    return this.establishmentsService.update(id, updateEstablishmentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.establishmentsService.remove(+id);
  }
}
