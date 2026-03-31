import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ShadowParamType {
  STRING = 'string',
  INT = 'int',
  FLOAT = 'float',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
}

@Entity({ name: 'shadow_params' })
export class ShadowParamEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: false })
  key: string;

  @Column({ type: 'enum', enum: ShadowParamType, default: ShadowParamType.STRING })
  type: ShadowParamType;

  @Column({ nullable: true })
  description?: string;
}
