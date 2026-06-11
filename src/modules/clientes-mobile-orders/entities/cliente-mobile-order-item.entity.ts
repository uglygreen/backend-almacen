import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClienteMobileOrder } from './cliente-mobile-order.entity';

@Entity('clientes_mobile_order_items')
export class ClienteMobileOrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'pedido_id', type: 'int', unsigned: true })
  pedidoId: number;

  @Column({ name: 'product_id', type: 'int', unsigned: true })
  productId: number;

  @Column({ type: 'varchar', length: 40 })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  descripcion: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagen: string | null;

  @Column({ name: 'clave_prod_serv', type: 'varchar', length: 8, nullable: true })
  claveProdServ: string | null;

  @Column({ name: 'clave_unidad', type: 'varchar', length: 3, nullable: true })
  claveUnidad: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  unidad: string | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  almacen: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  cantidad: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  lote: string | null;

  @Column({ name: 'precio_unitario', type: 'decimal', precision: 12, scale: 4 })
  precioUnitario: number;

  @Column({ name: 'iva_rate', type: 'decimal', precision: 7, scale: 4, default: 0 })
  ivaRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  iva: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => ClienteMobileOrder, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pedido_id' })
  order: ClienteMobileOrder;
}
