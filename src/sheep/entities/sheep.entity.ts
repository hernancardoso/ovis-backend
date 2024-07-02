import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { PaddockEntity } from 'src/paddocks/entities/paddock.entity';
import { SheepCollarEntity } from 'src/sheep-collar/entities/sheep-collar.entity';
import { PrimaryGeneratedColumn, Column, OneToMany, Entity, ManyToOne, JoinColumn } from 'typeorm';

@Entity({ name: 'sheep' })
export class SheepEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => PaddockEntity, (paddock) => paddock.sheep)
  @JoinColumn({ name: 'paddockId' })
  paddock: PaddockEntity;

  @Column({ nullable: false })
  paddockId: PaddockEntity['id'];

  @OneToMany(() => SheepCollarEntity, (sheepCollar) => sheepCollar.collar)
  collars: SheepCollarEntity[];
}
