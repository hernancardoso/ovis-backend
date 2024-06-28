import { SheepCollarEntity } from 'src/sheep-collar/entities/sheep-collar.entity';
import { PrimaryGeneratedColumn, Column, OneToMany, Entity } from 'typeorm';

@Entity()
export class SheepEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @OneToMany(() => SheepCollarEntity, (sheepCollar) => sheepCollar.collar)
  collars: SheepCollarEntity[];
}
