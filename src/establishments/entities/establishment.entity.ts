import { BreedsEntity } from 'src/breeds/entities/breed.entity';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { PaddockEntity } from 'src/paddocks/entities/paddock.entity';
import { Column, Entity, JoinTable, PrimaryGeneratedColumn, ManyToMany, OneToMany } from 'typeorm';

@Entity({ name: 'establishments' })
export class EstablishmentEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'simple-array' })
  tags: string[];

  @ManyToMany(() => BreedsEntity, (breed) => breed.establishments)
  @JoinTable()
  breeds: BreedsEntity[];

  @OneToMany(() => CollarEntity, (collar) => collar.establishment)
  collars: CollarEntity[];

  @OneToMany(() => PaddockEntity, (paddock) => paddock.establishment)
  paddocks: PaddockEntity[];
}
