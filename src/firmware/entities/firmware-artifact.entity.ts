import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum FirmwareArtifactStatus {
  PENDING_UPLOAD = 'PENDING_UPLOAD',
  READY = 'READY',
}

export enum FirmwareTarget {
  APP = 'APP',
}

@Entity({ name: 'firmware_artifacts' })
export class FirmwareArtifactEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: false })
  version: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 32, default: FirmwareTarget.APP })
  target: FirmwareTarget;

  @Column({ nullable: false })
  fileName: string;

  @Column({ nullable: false })
  s3Bucket: string;

  @Column({ nullable: false, unique: true })
  s3Key: string;

  @Column({ type: 'bigint', nullable: true })
  sizeBytes?: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sha256?: string | null;

  @Column({ type: 'varchar', length: 32, default: FirmwareArtifactStatus.PENDING_UPLOAD })
  status: FirmwareArtifactStatus;
}

