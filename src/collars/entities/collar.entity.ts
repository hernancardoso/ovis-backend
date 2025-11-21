import { Expose } from 'class-transformer';
import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { SheepCollarEntity } from 'src/sheep-collar/entities/sheep-collar.entity';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { LatestLocation } from '../interfaces/latest-location.interface';
import { LatestStatus } from '../interfaces/latest-status.interface';
import { type } from 'os';
import { ValueTransformer } from 'typeorm';

export const BigIntToNumberTransformer: ValueTransformer = {
  to: (value: number | string | null) => (value == null ? null : value.toString()), // store as string in DB for BIGINT
  from: (value: string | null): number | null => (value == null ? null : Number(value)), // IMEI is <= 10^15, within JS safe range
};

@Entity({ name: 'collars' })
export class CollarEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    nullable: false,
    type: 'bigint',
    default: 33,
    transformer: [BigIntToNumberTransformer],
    unique: true,
  })
  imei: number;

  @Column()
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => EstablishmentEntity, (establishment) => establishment.collars)
  @JoinColumn({ name: 'establishmentId' })
  establishment: EstablishmentEntity;

  @Column({ nullable: false })
  establishmentId: EstablishmentEntity['id'];

  @OneToMany(() => SheepCollarEntity, (sheepCollar) => sheepCollar.collar)
  sheep_history: SheepCollarEntity[];

  @OneToOne(() => SheepEntity, (sheep) => sheep.collar)
  @JoinColumn({ name: 'sheepId' }) // This is the owning side of the relationship
  sheep: SheepEntity;

  @Column({ nullable: true })
  sheepId: SheepEntity['id'] | null; // Foreign key to SheepEntity
}
