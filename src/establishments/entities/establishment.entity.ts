/* eslint-disable prettier/prettier */
/* user.entity.ts */
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';
import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';

@Entity({ name: 'establishments' })
export class EstablishmentEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @OneToMany(() => CollarEntity, (collar) => collar.establishment)
  collars: CollarEntity[];

  @OneToMany(() => SheepEntity, (sheep) => sheep.establishment)
  sheeps: SheepEntity[];
}
