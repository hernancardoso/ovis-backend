import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('analytics_events')
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  type: string; // 'ALERT', 'METRIC'

  @Column({ type: 'varchar', length: 100 })
  category: string; // 'PREDATOR', 'DISPERSION', 'GEOFENCE', etc.

  @Column({ type: 'varchar', nullable: true })
  imei?: string | null;

  @Column({ type: 'text', nullable: true })
  message?: string | null;

  @Column({ type: 'numeric', nullable: true })
  value?: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  severity?: string | null; // 'CRITICAL', 'WARNING', 'INFO'

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
