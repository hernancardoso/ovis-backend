import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { FotaDeploymentEntity } from './fota-deployment.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

export enum FotaTargetStatus {
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  UNKNOWN = 'UNKNOWN',
}

@Entity({ name: 'fota_deployment_targets' })
export class FotaDeploymentTargetEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FotaDeploymentEntity, { nullable: false })
  @JoinColumn({ name: 'deploymentId' })
  deployment: FotaDeploymentEntity;

  @Column({ nullable: false })
  deploymentId: FotaDeploymentEntity['id'];

  @ManyToOne(() => CollarEntity, { nullable: false })
  @JoinColumn({ name: 'collarId' })
  collar: CollarEntity;

  @Column({ nullable: false })
  collarId: CollarEntity['id'];

  @Column({ type: 'bigint', nullable: false })
  imei: number;

  @Column({ nullable: false })
  thingName: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  jobId?: string | null;

  @Column({ type: 'varchar', length: 32, default: FotaTargetStatus.UNKNOWN })
  status: FotaTargetStatus;

  @Column({ type: 'json', nullable: true })
  statusDetails?: any | null;
}

