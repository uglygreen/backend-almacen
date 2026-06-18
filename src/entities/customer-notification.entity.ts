import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum CustomerNotificationType {
  TEST_PUSH = 'test_push',
  VISIT_DAY = 'visit_day',
  OVERDUE_INVOICES = 'overdue_invoices',
  ORDER_STATUS_UPDATED = 'order_status_updated',
}

export enum CustomerNotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity('customer_notifications')
@Index('idx_customer_notifications_customer_created', ['customerId', 'createdAt'])
@Index('idx_customer_notifications_customer_deleted', ['customerId', 'deletedByUser'])
@Index('ux_customer_notifications_dedupe_key', ['dedupeKey'], { unique: true })
export class CustomerNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'customer_id', type: 'int', unsigned: true })
  customerId: number;

  @Column({
    type: 'enum',
    enum: CustomerNotificationType,
  })
  type: CustomerNotificationType;

  @Column({ type: 'varchar', length: 140 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  body: string;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 180 })
  dedupeKey: string;

  @Column({ name: 'metadata_json', type: 'simple-json', nullable: true })
  metadataJson: Record<string, any> | null;

  @Column({ name: 'scheduled_for', type: 'datetime', nullable: true })
  scheduledFor: Date | null;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt: Date | null;

  @Column({ name: 'deleted_by_user', type: 'tinyint', width: 1, default: () => '0' })
  deletedByUser: boolean;

  @Column({
    type: 'enum',
    enum: CustomerNotificationStatus,
    default: CustomerNotificationStatus.PENDING,
  })
  status: CustomerNotificationStatus;

  @Column({ name: 'fcm_message_ids', type: 'simple-json', nullable: true })
  fcmMessageIds: string[] | null;

  @Column({ name: 'error_code', type: 'varchar', length: 80, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_message', type: 'varchar', length: 255, nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
