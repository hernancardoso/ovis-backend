import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';
import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';

@Entity()
export class SheepCollarEntity extends TimestampedEntity {
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

  @Column({
    type: 'tinyint',
    generatedType: 'VIRTUAL',
    asExpression: 'assignedUntil IS NULL AND deletedAt IS NULL',
  })
  isActive: boolean;
}
