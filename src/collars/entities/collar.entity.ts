import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { SheepCollarEntity } from 'src/sheep-collar/entities/sheep-collar.entity';
import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

@Entity({ name: 'collars' })
export class CollarEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => EstablishmentEntity, (establishment) => establishment.collars)
  @JoinColumn({ name: 'establishmentId' })
  establishment: EstablishmentEntity;

  @Column({ nullable: false })
  establishmentId: EstablishmentEntity['id'];

  @OneToMany(() => SheepCollarEntity, (sheepCollar) => sheepCollar.collar)
  sheep: SheepCollarEntity[];
}
