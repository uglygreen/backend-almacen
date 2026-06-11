import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('clientes_credito_excepciones')
export class ClienteCreditoExcepcion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cliente_id', type: 'int', unsigned: true, nullable: true})
  clienteId: number | null;

  @Column({ name: 'numero_cliente', type: 'varchar', length: 20 })
  numeroCliente: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
