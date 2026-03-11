import { TimestampedEntity } from 'src/commons/entities/timestamped.entity';
import { FirmwareArtifactEntity } from 'src/firmware/entities/firmware-artifact.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'fota_deployments' })
export class FotaDeploymentEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FirmwareArtifactEntity, { nullable: false })
  @JoinColumn({ name: 'firmwareArtifactId' })
  firmwareArtifact: FirmwareArtifactEntity;

  @Column({ nullable: false })
  firmwareArtifactId: FirmwareArtifactEntity['id'];

  @Column({ nullable: false })
  jobIdPrefix: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  createdByEmail?: string | null;
}

