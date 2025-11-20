import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { EstablishmentsService } from './establishments.service';
import { CreateEstablishmentDto } from './dto/create-establishment.dto';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto';
import { EstablishmentEntity } from './entities/establishment.entity';
import { UpdateBreedsDto } from './dto/update-breeds.dto';
import { User } from 'src/commons/decorators/user.decorator';
import { User as IUser } from 'src/commons/interfaces/user.interface';

@Controller('establishments')
export class EstablishmentsController {
  constructor(private readonly establishmentsService: EstablishmentsService) {}

  @Get(':id/breeds')
  listBreeds(@Param('id') establishmentId: EstablishmentEntity['id']) {
    return this.establishmentsService.listBreeds(establishmentId);
  }

  @Put(':id/breeds')
  updateBreeds(
    @Param('id') establishmentId: EstablishmentEntity['id'],
    @Body() updateBreedsDto: UpdateBreedsDto
  ) {
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
  find(@User() user: IUser, @User('establishmentId') establishmentId?: string) {
    // If establishmentId is provided via query param (handled by decorator), use it
    // Otherwise, get establishmentId from establishmentIds array or fallback to establishmentId
    const finalEstablishmentId = establishmentId || user.establishmentIds?.[0] || user.establishmentId;
    
    // If user is admin and has no establishment, return all establishments
    if (!finalEstablishmentId && user.isAdmin) {
      return this.establishmentsService.findAll();
    }
    
    if (!finalEstablishmentId) {
      throw new UnauthorizedException('Establishment ID is required');
    }
    return this.establishmentsService.findByIdOrFail(finalEstablishmentId, ['breeds']);
  }

  @Get(':id')
  findOne(
    @Param('id') establishmentId: EstablishmentEntity['id'],
    @User() user: IUser
  ) {
    // Check if user has access to this establishment
    const userEstablishmentIds = user.establishmentIds || (user.establishmentId ? [user.establishmentId] : []);
    const hasAccess = user.isAdmin || userEstablishmentIds.includes(establishmentId);
    
    if (!hasAccess) {
      throw new ForbiddenException("Can't access");
    }

    return this.establishmentsService.findByIdOrFail(establishmentId, [
      'breeds',
      'paddocks',
      'collars',
    ]);
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
