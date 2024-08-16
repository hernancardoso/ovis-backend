import { BreedsEntity } from 'src/breeds/entities/breed.entity';
import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { PaddockEntity } from 'src/paddocks/entities/paddock.entity';
import { SheepCollarEntity } from 'src/sheep-collar/entities/sheep-collar.entity';
import { PrimaryGeneratedColumn, Column, OneToMany, Entity, ManyToOne, JoinColumn } from 'typeorm';

@Entity({ name: 'sheep' })
export class SheepEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'date', nullable: true })
  birth?: Date;

  @ManyToOne(() => BreedsEntity, (breed) => breed.sheeps)
  @JoinColumn({ name: 'breedId' })
  breed?: BreedsEntity;

  @Column({ nullable: true })
  breedId: BreedsEntity['id'];

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @ManyToOne(() => PaddockEntity, (paddock) => paddock.sheep)
  @JoinColumn({ name: 'paddockId' })
  paddock: PaddockEntity;

  @Column({ nullable: false })
  paddockId: PaddockEntity['id'];

  @OneToMany(() => SheepCollarEntity, (sheepCollar) => sheepCollar.collar)
  collars: SheepCollarEntity[];
}
