import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('payment_notification_checkpoints')
@Index('ux_payment_notification_checkpoints_job_key', ['jobKey'], { unique: true })
export class PaymentNotificationCheckpoint {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'job_key', type: 'varchar', length: 100 })
  jobKey: string;

  @Column({ name: 'last_pg_id', type: 'int', unsigned: true, default: () => '0' })
  lastPgId: number;

  @Column({ name: 'last_payment_at', type: 'datetime', nullable: true })
  lastPaymentAt: Date | null;

  @Column({ name: 'last_processed_at', type: 'datetime', nullable: true })
  lastProcessedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
