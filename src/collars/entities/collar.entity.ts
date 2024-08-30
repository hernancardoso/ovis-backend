import { Expose } from 'class-transformer';
import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { SheepCollarEntity } from 'src/sheep-collar/entities/sheep-collar.entity';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';
import { Column, Entity, PrimaryGeneratedColumn, OneToOne, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

@Entity({ name: 'collars' })
export class CollarEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
