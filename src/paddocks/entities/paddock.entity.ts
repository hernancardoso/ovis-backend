import { CollarEntity } from 'src/collars/entities/collar.entity';
import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';
import { Column, Entity, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';

@Entity({ name: 'paddocks' })
export class PaddockEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @OneToMany(() => SheepEntity, (sheep) => sheep.paddock)
  sheep: SheepEntity[] | null;

  @ManyToOne(() => EstablishmentEntity, (establishment) => establishment.paddocks)
  @JoinColumn({ name: 'establishmentId' })
  establishment: EstablishmentEntity;

  @Column({ nullable: false })
  establishmentId: EstablishmentEntity['id'];
}
