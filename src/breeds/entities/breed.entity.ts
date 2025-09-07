import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { SheepCollarEntity } from 'src/sheep-collar/entities/sheep-collar.entity';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';
import { Column, Entity, PrimaryGeneratedColumn, ManyToMany, JoinColumn, OneToMany } from 'typeorm';

@Entity({ name: 'breeds' })
export class BreedsEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToMany(() => EstablishmentEntity, (establishment) => establishment.breeds)
  establishments: EstablishmentEntity[];

  @OneToMany(() => SheepEntity, (sheep) => sheep.breed)
  sheeps: SheepEntity[];
}
