import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Cliente } from './cliente.entity';
import { DocLegacy, PagDocLegacy } from './doc-legacy.entity';
import { Personal } from './personal.entity';

@Entity('PAGOS')
export class PagoLegacy {
  @PrimaryGeneratedColumn({ name: 'PGID', type: 'int', unsigned: true })
  pgId: number;

  @Column({ name: 'PGIMPORTE', type: 'decimal', precision: 11, scale: 2 })
  pgImporte: number;

  @Column({ name: 'PGFORMAPAGO', type: 'char', length: 1 })
  pgFormaPago: string;

  @Column({ name: 'PGFECHA', type: 'datetime' })
  pgFecha: Date;

  @Column({ name: 'PGFECHAAPLICADA', type: 'date' })
  pgFechaAplicada: Date;

  @Column({ name: 'PGORIGEN', type: 'char', length: 1 })
  pgOrigen: string;

  @Column({ name: 'PGCLIENTEID', type: 'int', unsigned: true })
  pgClienteId: number;

  @Column({ name: 'PGTERMINALID', type: 'int', unsigned: true })
  pgTerminalId: number;

  @Column({ name: 'PGEMISORID', type: 'int', unsigned: true })
  pgEmisorId: number;

  @Column({ name: 'PGREFERENCIA', type: 'varchar', length: 15 })
  pgReferencia: string;

  @Column({ name: 'PGCOMPAGID', type: 'int', unsigned: true })
  pgCompagId: number;

  @Column({ name: 'PGRECIBO', type: 'int', unsigned: true })
  pgRecibo: number;

  @ManyToOne(() => Cliente, (cliente) => cliente.pagosLegacy, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'PGCLIENTEID', referencedColumnName: 'clienteId' })
  cliente: Relation<Cliente>;

  @ManyToOne(() => Personal, (personal) => personal.pagosEmitidosLegacy, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'PGEMISORID', referencedColumnName: 'perId' })
  emisorDetalle: Relation<Personal>;

  @ManyToOne(() => CompagLegacy, (compag) => compag.pagos, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'PGCOMPAGID', referencedColumnName: 'cpId' })
  complementoPago: Relation<CompagLegacy>;

  @OneToMany(() => PagDocLegacy, (pagDoc) => pagDoc.pago, {
    createForeignKeyConstraints: false,
  })
  aplicacionesDocumento: Relation<PagDocLegacy[]>;
}

@Entity('CFD')
export class CfdLegacy {
  @PrimaryGeneratedColumn({ name: 'CFDID', type: 'int', unsigned: true })
  cfdId: number;

  @Column({ name: 'DOCID', type: 'int', unsigned: true })
  docId: number;

  @Column({ name: 'TIPDOC', type: 'char', length: 1 })
  tipDoc: string;

  @Column({ name: 'RFC', type: 'char', length: 13 })
  rfc: string;

  @Column({ name: 'TIPCFD', type: 'char', length: 1 })
  tipCfd: string;

  @Column({ name: 'SERIE', type: 'char', length: 10 })
  serie: string;

  @Column({ name: 'FOLIO', type: 'char', length: 10 })
  folio: string;

  @Column({ name: 'NCEREMI', type: 'decimal', precision: 2, scale: 0 })
  nCerEmi: number;

  @Column({ name: 'APROBACION', type: 'varchar', length: 14 })
  aprobacion: string;

  @Column({ name: 'FECHA', type: 'date' })
  fecha: Date;

  @Column({ name: 'HORA', type: 'char', length: 8 })
  hora: string;

  @Column({ name: 'TOTAL', type: 'decimal', precision: 13, scale: 2 })
  total: number;

  @Column({ name: 'IMPUESTO', type: 'decimal', precision: 13, scale: 2 })
  impuesto: number;

  @Column({ name: 'CFDDESCUENTO', type: 'decimal', precision: 13, scale: 2 })
  cfdDescuento: number;

  @Column({ name: 'CFDMONEDA', type: 'char', length: 3 })
  cfdMoneda: string;

  @Column({ name: 'CFDTIPOCAMBIO', type: 'decimal', precision: 7, scale: 4 })
  cfdTipoCambio: number;

  @Column({ name: 'ESTADO', type: 'char', length: 1 })
  estado: string;

  @Column({ name: 'EFECTO', type: 'char', length: 1 })
  efecto: string;

  @Column({ name: 'CFDFORMAPAGO', type: 'char', length: 2 })
  cfdFormaPago: string;

  @Column({ name: 'CFDMETODOPAGO', type: 'char', length: 3 })
  cfdMetodoPago: string;

  @Column({ name: 'PEDIMENTO', type: 'char', length: 1 })
  pedimento: string;

  @Column({ name: 'FPEDIMENTO', type: 'char', length: 1 })
  fPedimento: string;

  @Column({ name: 'ADUANA', type: 'char', length: 1 })
  aduana: string;

  @Column({ name: 'XMLTAM', type: 'decimal', precision: 7, scale: 0 })
  xmlTam: number;

  @Column({ name: 'XML', type: 'mediumtext', nullable: true })
  xml: string | null;

  @Column({ name: 'CBB', type: 'mediumblob', nullable: true })
  cbb: Buffer | null;

  @Column({ name: 'CADENA', type: 'mediumtext', nullable: true })
  cadena: string | null;

  @Column({ name: 'DIGESTO', type: 'varchar', length: 32 })
  digesto: string;

  @Column({ name: 'DIGESTO2', type: 'varchar', length: 32 })
  digesto2: string;

  @Column({ name: 'UUID', type: 'varchar', length: 36 })
  uuid: string;

  @Column({ name: 'ID', type: 'decimal', precision: 9, scale: 0 })
  idLegacy: number;

  @Column({ name: 'FECHATIMB', type: 'char', length: 19 })
  fechaTimb: string;

  @Column({ name: 'CAMBIADO', type: 'timestamp' })
  cambiado: Date;

  @Column({ name: 'CERTISAT', type: 'varchar', length: 20 })
  certiSat: string;

  @ManyToOne(() => DocLegacy, (doc) => doc.cfds, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'DOCID', referencedColumnName: 'docId' })
  documento: Relation<DocLegacy>;

  @OneToMany(() => CompagLegacy, (compag) => compag.cfd, {
    createForeignKeyConstraints: false,
  })
  complementosPago: Relation<CompagLegacy[]>;
}

@Entity('COMPAG')
export class CompagLegacy {
  @PrimaryGeneratedColumn({ name: 'CPID', type: 'int', unsigned: true })
  cpId: number;

  @Column({ name: 'CPSERIEID', type: 'int', unsigned: true })
  cpSerieId: number;

  @Column({ name: 'CPCFDID', type: 'int', unsigned: true })
  cpCfdId: number;

  @Column({ name: 'CPCLIENTEID', type: 'int', unsigned: true })
  cpClienteId: number;

  @Column({ name: 'CPFOLIO', type: 'decimal', precision: 10, scale: 0 })
  cpFolio: number;

  @Column({ name: 'CPSERIE', type: 'char', length: 6 })
  cpSerie: string;

  @Column({ name: 'CPFECHA', type: 'date' })
  cpFecha: Date;

  @Column({ name: 'CPHORA', type: 'char', length: 8 })
  cpHora: string;

  @Column({ name: 'CPMONTOTOTAL', type: 'decimal', precision: 13, scale: 2 })
  cpMontoTotal: number;

  @Column({ name: 'CPESTADO', type: 'char', length: 1 })
  cpEstado: string;

  @ManyToOne(() => CfdLegacy, (cfd) => cfd.complementosPago, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'CPCFDID', referencedColumnName: 'cfdId' })
  cfd: Relation<CfdLegacy>;

  @ManyToOne(() => Cliente, (cliente) => cliente.complementosPagoLegacy, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'CPCLIENTEID', referencedColumnName: 'clienteId' })
  cliente: Relation<Cliente>;

  @OneToMany(() => PagoLegacy, (pago) => pago.complementoPago, {
    createForeignKeyConstraints: false,
  })
  pagos: Relation<PagoLegacy[]>;
}
