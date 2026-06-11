import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AlmLegacy } from './alm-legacy.entity';
import { DesLegacy } from './des-legacy.entity';
import { UnidadLegacy } from './unidad-legacy.entity';

@Entity('INV')
export class InvLegacy {
  @PrimaryGeneratedColumn({ name: 'ARTICULOID', type: 'int', unsigned: true })
  articuloId: number;

  @Column({ name: 'CLAVE', type: 'char', length: 20, nullable: true })
  clave: string;

  @Column({ name: 'DESCRIPCIO', type: 'varchar', length: 50, nullable: true })
  descripcio: string;

  @Column({ name: 'CLVPROV', type: 'char', length: 16, nullable: true })
  clvProv: string;

  @Column({ name: 'CLAVEPRODSERV', type: 'decimal', precision: 8, scale: 0, nullable: true })
  claveProdServ: number;

  @Column({ name: 'CLAVEPRODSERVCP', type: 'decimal', precision: 8, scale: 0, nullable: true })
  claveProdServCp: number;

  @Column({ name: 'CLAVEMATPELIGROSO', type: 'char', length: 4, nullable: true })
  claveMatPeligroso: string;

  @Column({ name: 'INVEMBALAJE', type: 'char', length: 3, nullable: true })
  invEmbalaje: string;

  @Column({ name: 'CODBAR', type: 'char', length: 13, nullable: true })
  codBar: string;

  @Column({ name: 'PROVEEDORID', type: 'int', unsigned: true, nullable: true })
  proveedorId: number;

  @Column({ name: 'SIMILARID', type: 'int', unsigned: true, nullable: true })
  similarId: number;

  @Column({ name: 'FAMILIAID', type: 'int', unsigned: true, nullable: true })
  familiaId: number;

  @Column({ name: 'AGRUPARID', type: 'int', unsigned: true, nullable: true })
  agruparId: number;

  @Column({ name: 'CATALOGO', type: 'char', length: 1, nullable: true })
  catalogo: string;

  @Column({ name: 'DIBUJO', type: 'varchar', length: 30, nullable: true })
  dibujo: string;

  @Column({ name: 'KG', type: 'decimal', precision: 9, scale: 4, nullable: true })
  kg: number;

  @Column({ name: 'SATUNIDAD', type: 'char', length: 1, nullable: true })
  satUnidad: string;

  @Column({ name: 'INVACTDIC', type: 'char', length: 1, nullable: true })
  invActDic: string;

  @Column({ name: 'INVACTPRE', type: 'char', length: 1, nullable: true })
  invActPre: string;

  @Column({ name: 'INVCAMBIADO', type: 'timestamp', nullable: true })
  invCambiado: Date;

  @Column({ name: 'COLOR', type: 'smallint', unsigned: true, nullable: true })
  color: number;

  @Column({ name: 'UNIBASID', type: 'int', unsigned: true, nullable: true })
  uniBasId: number;

  @Column({ name: 'UNICOMID', type: 'int', unsigned: true, nullable: true })
  uniComId: number;

  @Column({ name: 'UNIVENID', type: 'int', unsigned: true, nullable: true })
  uniVenId: number;

  @Column({ name: 'UNITRAID', type: 'int', unsigned: true, nullable: true })
  uniTraId: number;

  @Column({ name: 'MONEDA', type: 'decimal', precision: 1, scale: 0, nullable: true })
  moneda: number;

  @Column({ name: 'MODO', type: 'char', length: 1, nullable: true })
  modo: string;

  @Column({ name: 'COSTO', type: 'decimal', precision: 14, scale: 6, nullable: true })
  costo: number;

  @Column({ name: 'COSTO_ANTERIOR', type: 'decimal', precision: 14, scale: 6, nullable: true })
  costoAnterior: number;

  @Column({ name: 'COSTO_PROMEDIO', type: 'decimal', precision: 15, scale: 7, nullable: true })
  costoPromedio: number;

  @Column({ name: 'GASTOS', type: 'decimal', precision: 14, scale: 6, nullable: true })
  gastos: number;

  @Column({ name: 'GASTOSP', type: 'decimal', precision: 5, scale: 2, nullable: true })
  gastosP: number;

  @Column({ name: 'LISTA', type: 'decimal', precision: 14, scale: 6, nullable: true })
  lista: number;

  @Column({ name: 'CAMPRE', type: 'datetime', nullable: true })
  camPre: Date;

  @Column({ name: 'FACTOR', type: 'decimal', precision: 7, scale: 4, nullable: true })
  factor: number;

  @Column({ name: 'INVDESCUENTO', type: 'decimal', precision: 8, scale: 4, nullable: true })
  invDescuento: number;

  @Column({ name: 'LOTE', type: 'decimal', precision: 7, scale: 2, nullable: true })
  lote: number;

  @Column({ name: 'ULTIMA', type: 'date', nullable: true })
  ultima: Date;

  @Column({ name: 'ENTREGA', type: 'smallint', unsigned: true, nullable: true })
  entrega: number;

  @Column({ name: 'SERIADO', type: 'char', length: 1, nullable: true })
  seriado: string;

  @Column({ name: 'INVIEPS', type: 'decimal', precision: 6, scale: 2, nullable: true })
  invIeps: number;

  @Column({ name: 'IEPSFC', type: 'char', length: 1, nullable: true })
  iepsFc: string;

  @Column({ name: 'INVIMPUESTOL', type: 'decimal', precision: 6, scale: 2, nullable: true })
  invImpuestoL: number;

  @Column({ name: 'IMPLOCFC', type: 'char', length: 1, nullable: true })
  impLocFc: string;

  @Column({ name: 'NOMIMPLOC', type: 'decimal', precision: 1, scale: 0, nullable: true })
  nomImpLoc: number;

  @Column({ name: 'LOTEEXI', type: 'char', length: 1, nullable: true })
  loteExi: string;

  @Column({ name: 'USADO', type: 'char', length: 1, nullable: true })
  usado: string;

  @Column({ name: 'ALMDEF', type: 'smallint', unsigned: true, nullable: true })
  almDef: number;

  @Column({ name: 'GRUALMDEF', type: 'char', length: 1, nullable: true })
  gruAlmDef: string;

  @Column({ name: 'INVUSAALMSEC', type: 'char', length: 1, nullable: true })
  invUsaAlmSec: string;

  @Column({ name: 'FECALTART', type: 'date', nullable: true })
  fecAltArt: Date;

  @Column({ name: 'INVADUANA', type: 'char', length: 15, nullable: true })
  invAduana: string;

  @Column({ name: 'INVEMISOR', type: 'char', length: 2, nullable: true })
  invEmisor: string;

  @Column({ name: 'INVEMISORID', type: 'int', unsigned: true, nullable: true })
  invEmisorId: number;

  @Column({ name: 'INVMODIFICADO', type: 'char', length: 1, nullable: true })
  invModificado: string;

  @Column({ name: 'METODOMINIMO', type: 'char', length: 3, nullable: true })
  metodoMinimo: string;

  @Column({ name: 'IMPUESTO2', type: 'char', length: 1, nullable: true })
  impuesto2: string;

  @Column({ name: 'INVLOTMAR', type: 'decimal', precision: 1, scale: 0, nullable: true })
  invLotMar: number;

  @Column({ name: 'DESCUENTOS', type: 'char', length: 15, nullable: true })
  descuentos: string;

  @Column({ name: 'REPCAPARTID', type: 'int', unsigned: true, nullable: true })
  repCapArtId: number;

  @Column({ name: 'LARGO', type: 'decimal', precision: 3, scale: 0, nullable: true })
  largo: number;

  @Column({ name: 'ANCHO', type: 'decimal', precision: 3, scale: 0, nullable: true })
  ancho: number;

  @Column({ name: 'ALTO', type: 'decimal', precision: 3, scale: 0, nullable: true })
  alto: number;

  @Column({ name: 'XID_MICRO', type: 'varchar', length: 10, nullable: true })
  xIdMicro: string;

  @Column({ name: 'XWEB', type: 'char', length: 1, nullable: true })
  xWeb: string;

  @Column({ name: 'XIMAGEN2', type: 'varchar', length: 55, nullable: true })
  xImagen2: string;

  @Column({ name: 'XMCA_IMAG', type: 'varchar', length: 15, nullable: true })
  xMcaImag: string;

  @Column({ name: 'XXMARCA', type: 'varchar', length: 25, nullable: true })
  xxMarca: string;

  @Column({ name: 'XDESTACADO', type: 'char', length: 1, nullable: true })
  xDestacado: string;

  @Column({ name: 'XETIQUETA', type: 'decimal', precision: 1, scale: 0, nullable: true })
  xEtiqueta: number;

  @Column({ name: 'XPRIORIDAD', type: 'decimal', precision: 4, scale: 0, nullable: true })
  xPrioridad: number;

  @Column({ name: 'XINTRO', type: 'char', length: 5, nullable: true })
  xIntro: string;

  @Column({ name: 'XGUIA', type: 'char', length: 1, nullable: true })
  xGuia: string;

  @Column({ name: 'XREVISIONDIA', type: 'decimal', precision: 2, scale: 0, nullable: true })
  xRevisionDia: number;

  @Column({ name: 'XALM', type: 'char', length: 1, nullable: true })
  xAlm: string;

  @Column({ name: 'XABC', type: 'char', length: 2, nullable: true })
  xAbc: string;

  @OneToMany(() => DesLegacy, (detalle) => detalle.articulo, {
    createForeignKeyConstraints: false,
  })
  detallesDocumento: DesLegacy[];

  @OneToMany(() => AlmLegacy, (almacen) => almacen.articulo, {
    createForeignKeyConstraints: false,
  })
  almacenes: AlmLegacy[];

  @ManyToOne(() => UnidadLegacy, (unidad) => unidad.articulosBase, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn([
    { name: 'ARTICULOID', referencedColumnName: 'articuloId' },
    { name: 'UNIBASID', referencedColumnName: 'unidadId' },
  ])
  unidadBase: UnidadLegacy;
}
