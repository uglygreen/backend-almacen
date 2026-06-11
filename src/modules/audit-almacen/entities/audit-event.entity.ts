import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_event')
export class AuditEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'event_type', type: 'varchar', length: 80 })
  eventType: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 80, nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 120, nullable: true })
  entityId: string | null;

  @Column({ name: 'operator_id', type: 'int', nullable: true })
  operatorId: number | null;

  @Column({ name: 'status', type: 'varchar', length: 30 })
  status: string;

  @Column({ name: 'source_module', type: 'varchar', length: 80 })
  sourceModule: string;

  @Column({ name: 'summary', type: 'varchar', length: 255 })
  summary: string;

  @Column({ name: 'payload', type: 'json', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
