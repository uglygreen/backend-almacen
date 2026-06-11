import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('device_tokens')
@Index('idx_device_tokens_customer_active', ['customerId', 'isActive'])
@Index('ux_device_tokens_fcm_token', ['fcmToken'], { unique: true })
export class DeviceToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'customer_id', type: 'int', unsigned: true })
  customerId: number;

  @Column({ name: 'fcm_token', type: 'varchar', length: 255 })
  fcmToken: string;

  @Column({ type: 'varchar', length: 20 })
  platform: string;

  @Column({ name: 'device_name', type: 'varchar', length: 120, nullable: true })
  deviceName: string | null;

  @Column({ name: 'app_version', type: 'varchar', length: 40, nullable: true })
  appVersion: string | null;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: () => '1' })
  isActive: boolean;

  @Column({ name: 'last_seen_at', type: 'datetime', nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
