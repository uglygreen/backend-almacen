import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClienteMobileOrder, ClienteMobileOrderStatus } from './cliente-mobile-order.entity';

@Entity('clientes_mobile_order_status_history')
@Index('idx_clientes_mobile_order_status_history_order_created', ['orderId', 'createdAt'])
export class ClienteMobileOrderStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', unsigned: true })
  orderId: number;

  @Column({
    name: 'previous_status',
    type: 'enum',
    enum: ClienteMobileOrderStatus,
    nullable: true,
  })
  previousStatus: ClienteMobileOrderStatus | null;

  @Column({
    type: 'enum',
    enum: ClienteMobileOrderStatus,
  })
  status: ClienteMobileOrderStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  message: string | null;

  @Column({ name: 'changed_by', type: 'varchar', length: 100, nullable: true })
  changedBy: string | null;

  @Column({ name: 'notify_customer', type: 'tinyint', width: 1, default: () => '0' })
  notifyCustomer: boolean;

  @Column({ name: 'notification_id', type: 'int', unsigned: true, nullable: true })
  notificationId: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => ClienteMobileOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: ClienteMobileOrder;
}
