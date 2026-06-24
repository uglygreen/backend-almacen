import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClienteMobileOrderLegacyDocument } from './cliente-mobile-order-legacy-document.entity';
import { ClienteMobileOrderItem } from './cliente-mobile-order-item.entity';

export enum ClienteMobileOrderStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  ACCEPTED = 'ACCEPTED',
  PACKING = 'PACKING',
  READY_TO_SHIP = 'READY_TO_SHIP',
  IN_ROUTE = 'IN_ROUTE',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum ClienteMobileOrderDeliveryType {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP',
}

@Entity('clientes_mobile_orders')
export class ClienteMobileOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cliente_id', type: 'int', unsigned: true })
  clienteId: number;

  @Column({ name: 'cliente_numero', type: 'varchar', length: 20 })
  clienteNumero: string;

  @Column({
    type: 'enum',
    enum: ClienteMobileOrderStatus,
    default: ClienteMobileOrderStatus.DRAFT,
  })
  status: ClienteMobileOrderStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  iva: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total: number;

  @Column({
    name: 'delivery_type',
    type: 'enum',
    enum: ClienteMobileOrderDeliveryType,
    nullable: true,
  })
  deliveryType: ClienteMobileOrderDeliveryType | null;

  @Column({ name: 'address_id', type: 'int', unsigned: true, nullable: true })
  addressId: number | null;

  @Column({ name: 'address_snapshot', type: 'simple-json', nullable: true })
  addressSnapshot: Record<string, any> | null;

  @Column({ type: 'varchar', length: 13, nullable: true })
  rfc: string | null;

  @Column({ name: 'cfdi_use', type: 'varchar', length: 3, nullable: true })
  cfdiUse: string | null;

  @Column({ name: 'credit_snapshot', type: 'simple-json', nullable: true })
  creditSnapshot: Record<string, any> | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nota: string | null;

  @Column({ name: 'mobile_reference', type: 'varchar', length: 50, nullable: true })
  mobileReference: string | null;

  @Column({ name: 'legacy_documents_count', type: 'int', unsigned: true, default: 0 })
  legacyDocumentsCount: number;

  @Column({
    name: 'all_legacy_documents_invoiced',
    type: 'tinyint',
    width: 1,
    default: () => '0',
  })
  allLegacyDocumentsInvoiced: boolean;

  @Column({ name: 'last_legacy_sync_at', type: 'datetime', nullable: true })
  lastLegacySyncAt: Date | null;

  @Column({ name: 'submitted_at', type: 'datetime', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => ClienteMobileOrderItem, (item) => item.order, {
    cascade: false,
  })
  items: ClienteMobileOrderItem[];

  @OneToMany(() => ClienteMobileOrderLegacyDocument, (document) => document.order, {
    cascade: false,
  })
  legacyDocuments: ClienteMobileOrderLegacyDocument[];
}
