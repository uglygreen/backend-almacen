import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Cliente } from './cliente.entity';
import { Producto } from './index'; // Importing from index where Producto is defined

export enum EstatusGarantia {
  PENDIENTE_REVISION = 'PENDIENTE',
  RECIBIDO_ALMACEN = 'RECIBIDO',
  EN_DIAGNOSTICO = 'EN_DIAGNOSTICO',
  PROCEDE_CAMBIO = 'PROCEDE_CAMBIO',
  PROCEDE_NOTA_CREDITO = 'PROCEDE_NOTA_CREDITO',
  NO_PROCEDE = 'NO_PROCEDE', // Rechazada
  ENVIADO_CLIENTE = 'ENVIADO_CLIENTE',
  ENTREGADO_CLIENTE = 'ENTREGADO_CLIENTE',
  CONCLUIDO = 'CONCLUIDO'
}

@Entity('garantias_fmo')
export class Garantia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  folio: string;

  @Column({ name: 'num_cli', nullable: true })
  numCli: string;

  @Column({ name: 'producto_id' })
  productoId: number;

  @Column({ name: 'factura_id', type: 'int', nullable: true })
  facturaId: number;

  @Column({ name: 'num_factura', nullable: true })
  numFactura: string;

  @Column({ name: 'telefono_contacto', nullable: true })
  telefonoContacto: string;

  @Column({ name: 'nombre_contacto', nullable: true })
  nombreContacto: string; // Para público general o contacto alternativo

  @Column({ name: 'per_id', type: 'int', nullable: true })
  perId: number;

  @Column({ name: 'descripcion_falla', type: 'text' })
  descripcionFalla: string;

  @Column({
    name: 'estatus_actual',
    type: 'enum',
    enum: EstatusGarantia,
    default: EstatusGarantia.PENDIENTE_REVISION
  })
  estatusActual: EstatusGarantia;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion: Date;

  @ManyToOne(() => Producto)
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;

  @OneToMany(() => HistorialEstatusGarantia, (historial) => historial.garantia)
  historial: HistorialEstatusGarantia[];

  @OneToMany(() => MediaGarantia, (media) => media.garantia)
  media: MediaGarantia[];
}

@Entity('historial_estatus_garantia')
export class HistorialEstatusGarantia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'garantia_id' })
  garantiaId: number;

  @Column({
    name: 'estatus_anterior',
    type: 'enum',
    enum: EstatusGarantia,
    nullable: true
  })
  estatusAnterior: EstatusGarantia | null;

  @Column({
    name: 'estatus_nuevo',
    type: 'enum',
    enum: EstatusGarantia
  })
  estatusNuevo: EstatusGarantia;

  @Column({ name: 'usuario_responsable', nullable: true })
  usuarioResponsable: string; // Nombre o ID del usuario que hizo el cambio

  @Column({ nullable: true, type: 'text' })
  comentario: string;

  @CreateDateColumn({ name: 'fecha_cambio' })
  fechaCambio: Date;

  @ManyToOne(() => Garantia, (garantia) => garantia.historial)
  @JoinColumn({ name: 'garantia_id' })
  garantia: Garantia;
}

@Entity('media_garantia')
export class MediaGarantia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'garantia_id' })
  garantiaId: number;

  @Column()
  url: string;

  @Column({ name: 'tipo_archivo', default: 'imagen' }) // imagen, video, documento
  tipoArchivo: string;

  @CreateDateColumn({ name: 'fecha_subida' })
  fechaSubida: Date;

  @ManyToOne(() => Garantia, (garantia) => garantia.media)
  @JoinColumn({ name: 'garantia_id' })
  garantia: Garantia;
}
