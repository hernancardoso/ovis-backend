import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { FirmwareArtifactEntity } from 'src/firmware/entities/firmware-artifact.entity';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { FotaDeploymentEntity } from './fota-deployment.entity';
import { FotaDeploymentTargetEntity, FotaTargetStatus } from './fota-deployment-target.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'collar_firmware_history' })
export class CollarFirmwareHistoryEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CollarEntity, { nullable: false })
  @JoinColumn({ name: 'collarId' })
  collar: CollarEntity;

  @Column({ nullable: false })
  collarId: CollarEntity['id'];

  @Column({ type: 'bigint', nullable: false })
  imei: number;

  @ManyToOne(() => FirmwareArtifactEntity, { nullable: false })
  @JoinColumn({ name: 'firmwareArtifactId' })
  firmwareArtifact: FirmwareArtifactEntity;

  @Column({ nullable: false })
  firmwareArtifactId: FirmwareArtifactEntity['id'];

  @ManyToOne(() => FotaDeploymentEntity, { nullable: false })
  @JoinColumn({ name: 'deploymentId' })
  deployment: FotaDeploymentEntity;

  @Column({ nullable: false })
  deploymentId: FotaDeploymentEntity['id'];

  @ManyToOne(() => FotaDeploymentTargetEntity, { nullable: false })
  @JoinColumn({ name: 'deploymentTargetId' })
  deploymentTarget: FotaDeploymentTargetEntity;

  @Column({ nullable: false })
  deploymentTargetId: FotaDeploymentTargetEntity['id'];

  @Column({ type: 'varchar', length: 256, nullable: true })
  jobId?: string | null;

  @Column({ type: 'varchar', length: 32, default: FotaTargetStatus.UNKNOWN })
  status: FotaTargetStatus;

  @Column({ type: 'json', nullable: true })
  statusDetails?: any | null;
}

