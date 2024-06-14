import { PrimaryGeneratedColumn, Column } from 'typeorm';

export class SheepEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;
}
