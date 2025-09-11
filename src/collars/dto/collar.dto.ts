import { Expose } from 'class-transformer';
import { SheepReducedWithTagsDto } from 'src/sheep/dto/sheep-reduced-with-tags.dto';
import { LatestLocation } from '../interfaces/latest-location.interface';
import { LatestStatus } from '../interfaces/latest-status.interface';

export class CollarDto {
  @Expose()
  id: string;

  @Expose()
  imei: number;

  @Expose()
  name: string;

  @Expose()
  isActive: boolean;

  @Expose()
  latestLocation: LatestLocation;

  @Expose()
  latestStatus: LatestStatus;

  @Expose()
  sheep: SheepReducedWithTagsDto | null | undefined;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
