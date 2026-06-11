import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('clientes_mobile_otp')
export class ClienteMobileOtp {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cliente_id', type: 'int', unsigned: true })
  clienteId: number;

  @Column({ name: 'numero_cliente', type: 'varchar', length: 20 })
  numeroCliente: string;

  @Column({ name: 'correo', type: 'varchar', length: 60 })
  correo: string;

  @Column({ name: 'otp_hash', type: 'varchar', length: 128 })
  otpHash: string;

  @Column({ name: 'otp_salt', type: 'varchar', length: 64 })
  otpSalt: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'attempts', type: 'int', unsigned: true, default: () => '0' })
  attempts: number;

  @Column({ name: 'max_attempts', type: 'int', unsigned: true, default: () => '5' })
  maxAttempts: number;

  @Column({ name: 'blocked_until', type: 'datetime', nullable: true })
  blockedUntil: Date | null;

  @Column({ name: 'used_at', type: 'datetime', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
