import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Cliente } from './cliente.entity';

@Entity('CORREOS')
export class CorreoLegacy {
  @PrimaryGeneratedColumn({ name: 'CORREOID', type: 'int', unsigned: true })
  correoId: number;

  @Column({ name: 'CLIENTEID', type: 'int', unsigned: true, nullable: true })
  clienteId: number;

  @Column({ name: 'CORREO', type: 'varchar', length: 60, nullable: true })
  correo: string;

  @Column({ name: 'CENVIAR', type: 'char', length: 3, nullable: true })
  cEnviar: string;

  @Column({ name: 'CDESCRIPCION', type: 'varchar', length: 20, nullable: true })
  cDescripcion: string;

  @ManyToOne(() => Cliente, (cliente) => cliente.correos, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'CLIENTEID', referencedColumnName: 'clienteId' })
  cliente: Cliente;
}
