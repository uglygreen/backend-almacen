import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Cliente } from './cliente.entity';
import { DesLegacy } from './des-legacy.entity';
import { DomLegacy } from './dom-legacy.entity';
import { Personal } from './personal.entity';

@Entity('DOC')
export class DocLegacy {
  @PrimaryGeneratedColumn({ name: 'DOCID', type: 'int', unsigned: true })
  docId: number;

  @Column({ name: 'NUMERO', type: 'decimal', precision: 10, scale: 0, nullable: true })
  numero: number;

  @Column({ name: 'SERIE', type: 'char', length: 5, nullable: true })
  serie: string;

  @Column({ name: 'SERIEID', type: 'int', unsigned: true, nullable: true })
  serieId: number;

  @Column({ name: 'PAGINAS', type: 'smallint', unsigned: true, nullable: true })
  paginas: number;

  @Column({ name: 'TIPO', type: 'char', length: 1, nullable: true })
  tipo: string;

  @Column({ name: 'SUBTIPO', type: 'char', length: 1, nullable: true })
  subTipo: string;

  @Column({ name: 'ESTADO', type: 'char', length: 1, nullable: true })
  estado: string;

  @Column({ name: 'ESTADO2', type: 'char', length: 1, nullable: true })
  estado2: string;

  @Column({ name: 'ESTADOCFD', type: 'char', length: 1, nullable: true })
  estadoCfd: string;

  @Column({ name: 'PROCESOID', type: 'int', unsigned: true, nullable: true })
  procesoId: number;

  @Column({ name: 'AFECTADOC', type: 'char', length: 1, nullable: true })
  afectadoC: string;

  @Column({ name: 'COND', type: 'char', length: 1, nullable: true })
  cond: string;

  @Column({ name: 'CLIENTEID', type: 'int', unsigned: true, nullable: true })
  clienteId: number;

  @Column({ name: 'DOMDOCID', type: 'int', unsigned: true, nullable: true })
  domDocId: number;

  @Column({ name: 'DOMENVID', type: 'int', unsigned: true, nullable: true })
  domEnvId: number;

  @Column({ name: 'EMISORID', type: 'int', unsigned: true, nullable: true })
  emisorId: number;

  @Column({ name: 'EMISOR', type: 'char', length: 2, nullable: true })
  emisor: string;

  @Column({ name: 'VENDEDOR', type: 'char', length: 2, nullable: true })
  vendedor: string;

  @Column({ name: 'VENDEDORID', type: 'int', unsigned: true, nullable: true })
  vendedorId: number;

  @Column({ name: 'COBRADORID', type: 'int', unsigned: true, nullable: true })
  cobradorId: number;

  @Column({ name: 'DOCALM', type: 'smallint', unsigned: true, nullable: true })
  docAlm: number;

  @Column({ name: 'DOCALMDES', type: 'smallint', unsigned: true, nullable: true })
  docAlmDes: number;

  @Column({ name: 'FECHA', type: 'date', nullable: true })
  fecha: Date;

  @Column({ name: 'DOCFECHA', type: 'datetime', nullable: true })
  docFecha: Date;

  @Column({ name: 'FECCAP', type: 'date', nullable: true })
  fecCap: Date;

  @Column({ name: 'FECCAN', type: 'date', nullable: true })
  fecCan: Date;

  @Column({ name: 'FECULTENT', type: 'date', nullable: true })
  fecUltEnt: Date;

  @Column({ name: 'HORA', type: 'char', length: 8, nullable: true })
  hora: string;

  @Column({ name: 'VENCE', type: 'date', nullable: true })
  vence: Date;

  @Column({ name: 'TOTAL', type: 'decimal', precision: 11, scale: 2, nullable: true })
  total: number;

  @Column({ name: 'TOTALPAGADO', type: 'decimal', precision: 11, scale: 2, nullable: true })
  totalPagado: number;

  @Column({ name: 'TOTALPAGADOSBC', type: 'decimal', precision: 11, scale: 2, nullable: true })
  totalPagadoSbc: number;

  @Column({ name: 'COSTOTOTAL', type: 'decimal', precision: 11, scale: 2, nullable: true })
  costoTotal: number;

  @Column({ name: 'IMPCOSTO', type: 'decimal', precision: 11, scale: 2, nullable: true })
  impCosto: number;

  @Column({ name: 'SUBTOTAL0', type: 'decimal', precision: 11, scale: 2, nullable: true })
  subtotal0: number;

  @Column({ name: 'SUBTOTAL1', type: 'decimal', precision: 11, scale: 2, nullable: true })
  subtotal1: number;

  @Column({ name: 'SUBTOTAL2', type: 'decimal', precision: 11, scale: 2, nullable: true })
  subtotal2: number;

  @Column({ name: 'IMPUESTO', type: 'decimal', precision: 11, scale: 2, nullable: true })
  impuesto: number;

  @Column({ name: 'CONDICIONPAGO', type: 'char', length: 2, nullable: true })
  condicionPago: string;

  @Column({ name: 'USOCFD', type: 'char', length: 3, nullable: true })
  usoCfd: string;

  @Column({ name: 'DOCCFDID', type: 'int', unsigned: true, nullable: true })
  docCfdId: number;

  @Column({ name: 'IMPUESTOL', type: 'decimal', precision: 11, scale: 2, nullable: true })
  impuestoL: number;

  @Column({ name: 'IEPS', type: 'decimal', precision: 11, scale: 2, nullable: true })
  ieps: number;

  @Column({ name: 'RETENCION', type: 'decimal', precision: 11, scale: 2, nullable: true })
  retencion: number;

  @Column({ name: 'RETENCIONL', type: 'decimal', precision: 11, scale: 2, nullable: true })
  retencionL: number;

  @Column({ name: 'RETENISR', type: 'decimal', precision: 11, scale: 2, nullable: true })
  retenIsr: number;

  @Column({ name: 'ENTREGADO', type: 'char', length: 1, nullable: true })
  entregado: string;

  @Column({ name: 'LUGARENTREGA', type: 'char', length: 1, nullable: true })
  lugarEntrega: string;

  @Column({ name: 'DESCUENTO', type: 'decimal', precision: 6, scale: 2, nullable: true })
  descuento: number;

  @Column({ name: 'DOCDESCUENTODES', type: 'decimal', precision: 6, scale: 2, nullable: true })
  docDescuentoDes: number;

  @Column({ name: 'NOTA', type: 'varchar', length: 200, nullable: true })
  nota: string;

  @Column({ name: 'DOCRELID', type: 'int', unsigned: true, nullable: true })
  docRelId: number;

  @Column({ name: 'ORIGENID', type: 'int', unsigned: true, nullable: true })
  origenId: number;

  @Column({ name: 'DESTINOID', type: 'int', unsigned: true, nullable: true })
  destinoId: number;

  @Column({ name: 'ANTERIOR', type: 'char', length: 11, nullable: true })
  anterior: string;

  @Column({ name: 'TANTERIOR', type: 'char', length: 1, nullable: true })
  tAnterior: string;

  @Column({ name: 'CAMBIADO', type: 'timestamp', nullable: true })
  cambiado: Date;

  @Column({ name: 'ORITOTAL', type: 'decimal', precision: 11, scale: 2, nullable: true })
  oriTotal: number;

  @Column({ name: 'ORISUBTOTAL0', type: 'decimal', precision: 11, scale: 2, nullable: true })
  oriSubtotal0: number;

  @Column({ name: 'ORISUBTOTAL1', type: 'decimal', precision: 11, scale: 2, nullable: true })
  oriSubtotal1: number;

  @Column({ name: 'ORISUBTOTAL2', type: 'decimal', precision: 11, scale: 2, nullable: true })
  oriSubtotal2: number;

  @Column({ name: 'ORIIMPUESTO', type: 'decimal', precision: 11, scale: 2, nullable: true })
  oriImpuesto: number;

  @Column({ name: 'ORICOSTOTOTAL', type: 'decimal', precision: 11, scale: 2, nullable: true })
  oriCostoTotal: number;

  @Column({ name: 'TERMINALID', type: 'smallint', unsigned: true, nullable: true })
  terminalId: number;

  @Column({ name: 'COMISION', type: 'char', length: 1, nullable: true })
  comision: string;

  @Column({ name: 'XIMPRESION', type: 'decimal', precision: 5, scale: 0, nullable: true })
  xImpresion: number;

  @Column({ name: 'XXWEB', type: 'char', length: 3, nullable: true })
  xxWeb: string;

  @Column({ name: 'XCORREO', type: 'decimal', precision: 5, scale: 0, nullable: true })
  xCorreo: number;

  @Column({ name: 'XBONO', type: 'char', length: 1, nullable: true })
  xBono: string;

  @ManyToOne(() => Cliente, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'CLIENTEID', referencedColumnName: 'clienteId' })
  cliente: Cliente;

  @ManyToOne(() => DomLegacy, (domicilio) => domicilio.documentosComoDomDoc, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'DOMDOCID', referencedColumnName: 'domId' })
  domicilioDocumento: DomLegacy;

  @ManyToOne(() => Personal, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'EMISORID', referencedColumnName: 'perId' })
  emisorDetalle: Personal;

  @ManyToOne(() => Personal, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'VENDEDORID', referencedColumnName: 'perId' })
  vendedorDetalle: Personal;

  @ManyToOne(() => Personal, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'COBRADORID', referencedColumnName: 'perId' })
  cobradorDetalle: Personal;

  @OneToMany(() => PagDocLegacy, (pagDoc) => pagDoc.doc, {
    createForeignKeyConstraints: false,
  })
  pagos: PagDocLegacy[];

  @OneToMany(() => DesLegacy, (detalle) => detalle.documento, {
    createForeignKeyConstraints: false,
  })
  detalles: DesLegacy[];
}

@Entity('PAGDOC')
export class PagDocLegacy {
  @PrimaryGeneratedColumn({ name: 'PAGOID', type: 'int', unsigned: true })
  pagoId: number;

  @Column({ name: 'PAGPGID', type: 'int', unsigned: true, nullable: true })
  pagPgId: number;

  @Column({ name: 'DOCID', type: 'int', unsigned: true, nullable: true })
  docId: number;

  @Column({ name: 'FECHAPAG', type: 'datetime', nullable: true })
  fechaPag: Date;

  @Column({ name: 'TIPODOC', type: 'char', length: 1, nullable: true })
  tipoDoc: string;

  @Column({ name: 'PAGADO', type: 'decimal', precision: 11, scale: 2, nullable: true })
  pagado: number;

  @Column({ name: 'CAJAID', type: 'int', unsigned: true, nullable: true })
  cajaId: number;

  @Column({ name: 'BANCOID', type: 'int', unsigned: true, nullable: true })
  bancoId: number;

  @Column({ name: 'APLICADO', type: 'char', length: 1, nullable: true })
  aplicado: string;

  @ManyToOne(() => DocLegacy, (doc) => doc.pagos, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'DOCID', referencedColumnName: 'docId' })
  doc: DocLegacy;
}
