import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Pedido } from '../../../entities';
import { ClienteMobileOrder } from './cliente-mobile-order.entity';

@Entity('clientes_mobile_order_legacy_documents')
@Index('ux_clientes_mobile_order_legacy_documents_order_doc', ['orderId', 'legacyDocId'], {
  unique: true,
})
@Index('idx_clientes_mobile_order_legacy_documents_reference', ['matchedReference'])
export class ClienteMobileOrderLegacyDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', unsigned: true })
  orderId: number;

  @Column({ name: 'pedido_id', type: 'int', unsigned: true, nullable: true })
  pedidoId: number | null;

  @Column({ name: 'legacy_doc_id', type: 'int', unsigned: true })
  legacyDocId: number;

  @Column({ name: 'legacy_numero', type: 'varchar', length: 30, nullable: true })
  legacyNumero: string | null;

  @Column({ name: 'legacy_serie', type: 'varchar', length: 10, nullable: true })
  legacySerie: string | null;

  @Column({ name: 'legacy_tipo', type: 'varchar', length: 5, nullable: true })
  legacyTipo: string | null;

  @Column({ name: 'legacy_estado', type: 'varchar', length: 5, nullable: true })
  legacyEstado: string | null;

  @Column({ name: 'legacy_nota', type: 'varchar', length: 255, nullable: true })
  legacyNota: string | null;

  @Column({ name: 'matched_reference', type: 'varchar', length: 50, nullable: true })
  matchedReference: string | null;

  @Column({ name: 'is_facturado', type: 'tinyint', width: 1, default: () => '0' })
  isFacturado: boolean;

  @Column({ name: 'facturado_at', type: 'datetime', nullable: true })
  facturadoAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => ClienteMobileOrder, (order) => order.legacyDocuments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: ClienteMobileOrder;

  @ManyToOne(() => Pedido, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pedido_id' })
  pedido: Pedido | null;
}
