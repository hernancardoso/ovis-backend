import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { SheepCollarEntity } from 'src/sheep-collar/entities/sheep-collar.entity';
import { PrimaryGeneratedColumn, Column, OneToMany, Entity, ManyToOne, JoinColumn } from 'typeorm';

@Entity({ name: 'sheep' })
export class SheepEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => EstablishmentEntity, (establishment) => establishment.sheeps)
  @JoinColumn({ name: 'establishmentId' })
  establishment: EstablishmentEntity | null;

  @Column({ nullable: false })
  establishmentId: EstablishmentEntity['id'];

  @OneToMany(() => SheepCollarEntity, (sheepCollar) => sheepCollar.collar)
  collars: SheepCollarEntity[];
}
