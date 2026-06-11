import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('clientes_mobile_sessions')
export class ClienteMobileSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cliente_id', type: 'int', unsigned: true })
  clienteId: number;

  @Column({ name: 'numero_cliente', type: 'varchar', length: 20 })
  numeroCliente: string;

  @Column({ name: 'correo', type: 'varchar', length: 60 })
  correo: string;

  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 128 })
  refreshTokenHash: string;

  @Column({ name: 'device_name', type: 'varchar', length: 120, nullable: true })
  deviceName: string | null;

  @Column({ name: 'device_id', type: 'varchar', length: 120, nullable: true })
  deviceId: string | null;

  @Column({ name: 'last_ip', type: 'varchar', length: 64, nullable: true })
  lastIp: string | null;

  @Column({ name: 'last_user_agent', type: 'varchar', length: 255, nullable: true })
  lastUserAgent: string | null;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
