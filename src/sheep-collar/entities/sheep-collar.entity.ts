import { CollarEntity } from 'src/collars/entities/collar.entity';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity()
export class SheepCollarEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SheepEntity, (sheep) => sheep.collars)
  @JoinColumn({ name: 'sheepId' })
  sheep: SheepEntity;

  @ManyToOne(() => CollarEntity, (collar) => collar.sheep)
  @JoinColumn({ name: 'collarId' })
  collar: CollarEntity;

  @Column()
  assignedFrom: Date;

  @Column({ nullable: true })
  assignedUntil?: Date;
}
