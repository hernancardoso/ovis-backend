import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';

@Index('uniq_active_sheep_collar', ['sheepId', 'collarId'], {
  unique: true,
  where: 'assignedUntil IS NULL', // enforce one active collar per sheep
})
@Entity()
export class SheepCollarEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  sheepId: string;

  @ManyToOne(() => SheepEntity, (sheep) => sheep.sheep_history)
  @JoinColumn({ name: 'sheepId' })
  sheep: SheepEntity;

  @PrimaryColumn({ type: 'char', length: 36 })
  collarId: string;

  @ManyToOne(() => CollarEntity, (collar) => collar.sheep_history)
  @JoinColumn({ name: 'collarId' })
  collar: CollarEntity;

  @PrimaryColumn({ type: 'datetime' })
  assignedFrom: Date;

  @Column({ type: 'datetime', nullable: true })
  assignedUntil?: Date;
}
