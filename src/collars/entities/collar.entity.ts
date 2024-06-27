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
  @JoinColumn({ name: 'establishmentId' })
  establishment: EstablishmentEntity | undefined;
}

// interface CollarWith extends CollarEntity {
//   establishment: NonNullable<CollarEntity['establishment']>;
// }
