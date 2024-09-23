import { Expose } from 'class-transformer';
import { SheepReducedDto } from 'src/sheep/dto/sheep-reduced.dto';
import { LatestLocation } from '../interfaces/latest-location.interface';
import { LatestStatus } from '../interfaces/latest-status.interface';

export class CollarDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  isActive: boolean;

  @Expose()
  latestLocation: LatestLocation;

  @Expose()
  latestStatus: LatestStatus;

  @Expose()
  sheep: SheepReducedDto | null | undefined;
}
