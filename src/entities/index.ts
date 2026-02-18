import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';

// --------------------------------------------------------
// ENUMERACIONES (Deben coincidir con tu MySQL)
// --------------------------------------------------------

export enum Zona {
  CC = 'CUARTO_CHICO',
  AG = 'ALMACEN_GRAL',
}

export enum StatusGlobal {
  NUEVO = 'NUEVO',
  ESPERA_CC = 'EN_ESPERA_CUARTO_CHICO',
  EN_SURTIDO_CC = 'EN_SURTIDO_CC',
  PENDIENTE_AG = 'PENDIENTE_ALMACEN_GRAL',
  EN_SURTIDO_AG = 'EN_SURTIDO_ALMACEN',
  COMPLETADO = 'SURTIDO_COMPLETO',
  EMPAQUETADO = 'EMPAQUETADO',
  CANCELADO = 'CANCELADO',
}

export enum StatusLinea {
  PENDIENTE = 'PENDIENTE',
  COMPLETADO = 'SURTIDO_COMPLETO',
  PARCIAL = 'SURTIDO_PARCIAL',
  NO_ENCONTRADO = 'NO_ENCONTRADO',
}

export enum StatusEntrega {
  PENDIENTE = 'PENDIENTE',
  DISPONIBLE_OFICINA = 'DISPONIBLE_EN_OFICINA',
  ENTREGADO = 'ENTREGADO_CLIENTE',
}

// --------------------------------------------------------
// ENTIDADES
// --------------------------------------------------------

@Entity('almacen_user')
export class AlmacenUser {
  // --- Campos Originales (Respetando tu tabla existente) ---
  
  @PrimaryGeneratedColumn({ name: 'id_almacenista' })
  id: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 50 })
  usuario: string;

  @Column({ default: 1 })
  activo: boolean;

  
  @Column({ nullable: true })
  tiempo: string;

  @Column({ nullable: true })
  rotacion: string;

  @Column({ nullable: true })
  marquesina: string;

  @Column({ nullable: true })
  img: string;

  @Column({ nullable: true })
  capacitacion: string;

  @Column({ nullable: true })
  area: string;

  @Column({ nullable: true, type: 'float' }) 
  comision: number;

  @Column({ nullable: true })
  fecha: Date;

  @Column({ nullable: true })
  seccion: string;

  @Column({ name: 'idFerrum', nullable: true })
  idFerrum: number;

  @Column({ nullable: true })
  actividad: string;

  @Column({ name: 'fecha_act', nullable: true })
  fechaAct: Date;

}

@Entity('control_sincronizacion')
export class ControlSincronizacion {
  @Column({ primary: true })
  id: number;

  @Column({ name: 'ultimo_docid_sincronizado' })
  ultimoDocId: number;

  @Column({ name: 'fecha_ultima_ejecucion' })
  fechaEjecucion: Date;
}

@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  codigo: string;

  @Column()
  clave: string;

  @Column()
  nombre: string;

  @Column()
  codbar: string;

  @Column()
  ubicacion: string;

  @Column()
  img: string;

  @Column({ name: 'zona_asignada', type: 'enum', enum: Zona })
  zonaAsignada: Zona;
  
  @Column({ name: 'id_externo_articulo', nullable: true })
  idExterno: number;

  @OneToMany(() => ProductoCodigo, (pc) => pc.producto, { cascade: true })
  codigos: ProductoCodigo[];
}

@Entity('producto_codigos')
export class ProductoCodigo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  codigo: string;

  @Column()
  prefijo: number;

  @ManyToOne(() => Producto, (producto) => producto.codigos)
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;
}

@Entity('pedidos')
export class Pedido {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cliente_nombre' })
  clienteNombre: string;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;

  @Column({ name: 'requiere_cuarto_chico', default: false })
  requiereCuartoChico: boolean;

  @Column({ name: 'status_global', type: 'enum', enum: StatusGlobal, default: StatusGlobal.NUEVO })
  statusGlobal: StatusGlobal;

  @Column({ name: 'id_externo_doc', unique: true, nullable: true })
  idExternoDoc: number;

  @Column({ name: 'folio_externo', nullable: true })
  folioExterno: string;

  @Column()
  serie: string;

  @Column()
  clatexto: string;

  @Column({ name: 'es_recoge_en_oficina', default: false })
  esRecogeEnOficina: boolean;

  @Column({ name: 'status_entrega', type: 'enum', enum: StatusEntrega, default: StatusEntrega.PENDIENTE })
  statusEntrega: StatusEntrega;

  // Relaciones con usuarios (Surtidores)
  @Column({ name: 'surtidor_cc_id', nullable: true })
  surtidorCcId: number;

  @Column({ name: 'surtidor_ag_id', nullable: true })
  surtidorAgId: number;

  @ManyToOne(() => AlmacenUser)
  @JoinColumn({ name: 'surtidor_cc_id' })
  surtidorCc: AlmacenUser;

  @ManyToOne(() => AlmacenUser)
  @JoinColumn({ name: 'surtidor_ag_id' })
  surtidorAg: AlmacenUser;

  // Timestamps
  @Column({ name: 'fecha_inicio_cc', nullable: true })
  fechaInicioCc: Date;
  @Column({ name: 'fecha_fin_cc', nullable: true })
  fechaFinCc: Date;
  @Column({ name: 'fecha_inicio_ag', nullable: true })
  fechaInicioAg: Date;
  @Column({ name: 'fecha_fin_ag', nullable: true })
  fechaFinAg: Date;

  @OneToMany(() => DetallePedido, (detalle) => detalle.pedido, { cascade: true })
  detalles: DetallePedido[];
}

@Entity('detalle_pedidos')
export class DetallePedido {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'zona_surtido', type: 'enum', enum: Zona })
  zonaSurtido: Zona;

  @Column({ name: 'cantidad_solicitada' })
  cantidadSolicitada: number;

  @Column({ name: 'cantidad_surtida', default: 0 })
  cantidadSurtida: number;

  @Column({ name: 'status_linea', type: 'enum', enum: StatusLinea, default: StatusLinea.PENDIENTE })
  statusLinea: StatusLinea;

  @Column({ name: 'nota_incidencia', nullable: true })
  notaIncidencia: string;

  @ManyToOne(() => Pedido, (pedido) => pedido.detalles)
  @JoinColumn({ name: 'pedido_id' })
  pedido: Pedido;

  @ManyToOne(() => Producto)
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;
}

@Entity('surtido')
export class Surtido {
  @PrimaryGeneratedColumn({ name: 'id_surtido' })
  idSurtido: number;

  @Column({ name: 'id_almacenista' })
  idAlmacenista: number;

  @Column({ type: 'date', nullable: true })
  fecha: string; // or Date, keeping as string for simplicity if driver handles it, but TypeORM usually prefers Date or string. string is safer for 'date' type sometimes. Let's use string.

  @Column({ type: 'time', nullable: true })
  hora: string;

  @Column({ nullable: true })
  partidas: number;

  @Column({ nullable: true })
  pedido: number;

  @Column({ type: 'text', nullable: true })
  lugar: string;

  @Column({ name: 'fecha_aplicada', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  fechaAplicada: Date;

  @Column({ length: 3, nullable: true })
  serie: string;
}

export * from './cliente.entity';
export * from './config-almacen.entity';
export * from './garantia.entity';