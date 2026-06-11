import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Cliente } from './cliente.entity';
import { DocLegacy } from './doc-legacy.entity';
import { InvLegacy } from './inv-legacy.entity';
import { Personal } from './personal.entity';

@Entity('DES')
export class DesLegacy {
  @PrimaryGeneratedColumn({ name: 'DESID', type: 'int', unsigned: true })
  desId: number;

  @Column({ name: 'DESDOCID', type: 'int', unsigned: true, nullable: true })
  desDocId: number;

  @Column({ name: 'DESTIPO', type: 'char', length: 1, nullable: true })
  desTipo: string;

  @Column({ name: 'DESAFECTA', type: 'char', length: 1, nullable: true })
  desAfecta: string;

  @Column({ name: 'DESAFECTAART', type: 'char', length: 1, nullable: true })
  desAfectaArt: string;

  @Column({ name: 'DESFECHA', type: 'date', nullable: true })
  desFecha: Date;

  @Column({ name: 'DESHORA', type: 'char', length: 8, nullable: true })
  desHora: string;

  @Column({ name: 'DESSTATUS', type: 'char', length: 15, nullable: true })
  desStatus: string;

  @Column({ name: 'DESARTID', type: 'int', unsigned: true, nullable: true })
  desArtId: number;

  @Column({ name: 'DESCANTIDAD', type: 'decimal', precision: 10, scale: 3, nullable: true })
  desCantidad: number;

  @Column({ name: 'DESCANTIDADORIG', type: 'decimal', precision: 10, scale: 3, nullable: true })
  desCantidadOrig: number;

  @Column({ name: 'DESENTREGADO', type: 'decimal', precision: 10, scale: 3, nullable: true })
  desEntregado: number;

  @Column({ name: 'DESUNIID', type: 'int', unsigned: true, nullable: true })
  desUniId: number;

  @Column({ name: 'DESEQUIVALE', type: 'decimal', precision: 8, scale: 3, nullable: true })
  desEquivale: number;

  @Column({ name: 'DESCLIID', type: 'int', unsigned: true, nullable: true })
  desCliId: number;

  @Column({ name: 'DESCOSTO', type: 'decimal', precision: 14, scale: 6, nullable: true })
  desCosto: number;

  @Column({ name: 'DESVENTA', type: 'decimal', precision: 14, scale: 6, nullable: true })
  desVenta: number;

  @Column({ name: 'DESDESCUENTO', type: 'decimal', precision: 8, scale: 4, nullable: true })
  desDescuento: number;

  @Column({ name: 'DESALM', type: 'smallint', unsigned: true, nullable: true })
  desAlm: number;

  @Column({ name: 'DESALMDES', type: 'smallint', unsigned: true, nullable: true })
  desAlmDes: number;

  @Column({ name: 'DESEMISOR', type: 'char', length: 2, nullable: true })
  desEmisor: string;

  @Column({ name: 'DESEMISORID', type: 'int', unsigned: true, nullable: true })
  desEmisorId: number;

  @Column({ name: 'DESNIVEL', type: 'smallint', unsigned: true, nullable: true })
  desNivel: number;

  @Column({ name: 'DESOBS', type: 'char', length: 15, nullable: true })
  desObs: string;

  @Column({ name: 'DESESTADO', type: 'char', length: 1, nullable: true })
  desEstado: string;

  @Column({ name: 'DESIMPUESTOS', type: 'int', unsigned: true, nullable: true })
  desImpuestos: number;

  @Column({ name: 'DESIMPUESTO2', type: 'decimal', precision: 4, scale: 1, nullable: true })
  desImpuesto2: number;

  @Column({ name: 'DESLOTID', type: 'int', unsigned: true, nullable: true })
  desLotId: number;

  @Column({ name: 'DESPRECIO', type: 'smallint', unsigned: true, nullable: true })
  desPrecio: number;

  @Column({ name: 'DESCAMBIADO', type: 'timestamp', nullable: true })
  desCambiado: Date;

  @Column({ name: 'DESMODPRE', type: 'char', length: 1, nullable: true })
  desModPre: string;

  @Column({ name: 'DESORDEN', type: 'smallint', unsigned: true, nullable: true })
  desOrden: number;

  @Column({ name: 'DESIVA', type: 'decimal', precision: 15, scale: 6, nullable: true })
  desIva: number;

  @Column({ name: 'DESIEPS', type: 'decimal', precision: 6, scale: 2, nullable: true })
  desIeps: number;

  @Column({ name: 'DESIEPSFC', type: 'char', length: 1, nullable: true })
  desIepsFc: string;

  @Column({ name: 'DESIMPUESTOL', type: 'decimal', precision: 6, scale: 2, nullable: true })
  desImpuestoL: number;

  @Column({ name: 'DESIMPLOCFC', type: 'char', length: 1, nullable: true })
  desImpLocFc: string;

  @Column({ name: 'DESNOMIMPLOC', type: 'decimal', precision: 1, scale: 0, nullable: true })
  desNomImpLoc: number;

  @Column({ name: 'DESPREVEN', type: 'decimal', precision: 14, scale: 6, nullable: true })
  desPreVen: number;

  @ManyToOne(() => DocLegacy, (doc) => doc.detalles, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'DESDOCID', referencedColumnName: 'docId' })
  documento: DocLegacy;

  @ManyToOne(() => InvLegacy, (articulo) => articulo.detallesDocumento, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'DESARTID', referencedColumnName: 'articuloId' })
  articulo: InvLegacy;

  @ManyToOne(() => Cliente, (cliente) => cliente.detallesDocumento, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'DESCLIID', referencedColumnName: 'clienteId' })
  cliente: Cliente;

  @ManyToOne(() => Personal, (personal) => personal.detallesEmitidosDocumento, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'DESEMISORID', referencedColumnName: 'perId' })
  emisorDetalle: Personal;
}
