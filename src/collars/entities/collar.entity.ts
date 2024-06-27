import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity({ name: 'collars' })
export class CollarEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(
    () => EstablishmentEntity,
    (establishment) => establishment.collars,
    { nullable: false }
  )
  establishment: EstablishmentEntity | undefined;

  @Column({ nullable: false })
  establishmentId: EstablishmentEntity['id'];
}

interface CollarEntityWith extends CollarEntity {
  establishment: NonNullable<CollarEntity['establishment']>;
}
