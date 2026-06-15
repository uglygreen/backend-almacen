import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { InvLegacy } from './inv-legacy.entity';
import { NomAlmLegacy } from './nomalm-legacy.entity';

@Entity('ALM')
export class AlmLegacy {
  @PrimaryGeneratedColumn({ name: 'ALMID', type: 'int', unsigned: true })
  almId: number;

  @Column({ name: 'ARTICULOID', type: 'int', unsigned: true, nullable: true })
  articuloId: number;

  @Column({ name: 'ALMACEN', type: 'decimal', precision: 5, scale: 0, nullable: true })
  almacen: number;

  @Column({ name: 'COSTOPRO', type: 'decimal', precision: 15, scale: 7, nullable: true })
  costoPro: number;

  @Column({ name: 'COSTOAUX', type: 'decimal', precision: 15, scale: 7, nullable: true })
  costoAux: number;

  @Column({ name: 'VENDIA', type: 'decimal', precision: 8, scale: 3, nullable: true })
  venDia: number;

  @Column({ name: 'ULTMOV', type: 'datetime', nullable: true })
  ultMov: Date;

  @Column({ name: 'ULTINV', type: 'date', nullable: true })
  ultInv: Date;

  @Column({ name: 'CONTROL', type: 'char', length: 1, nullable: true })
  control: string;

  @Column({ name: 'LIMITAR', type: 'char', length: 1, nullable: true })
  limitar: string;

  @Column({ name: 'CAMBIADO', type: 'timestamp', nullable: true })
  cambiado: Date;

  @Column({ name: 'MODIFICADO', type: 'char', length: 1, nullable: true })
  modificado: string;

  @Column({ name: 'APARTADO', type: 'decimal', precision: 10, scale: 3, nullable: true })
  apartado: number;

  @Column({ name: 'ENTREGAR', type: 'decimal', precision: 10, scale: 3, nullable: true })
  entregar: number;

  @Column({ name: 'AUXILIAR', type: 'decimal', precision: 10, scale: 3, nullable: true })
  auxiliar: number;

  @Column({ name: 'MIN', type: 'decimal', precision: 6, scale: 0, nullable: true })
  min: number;

  @Column({ name: 'UBICACION', type: 'char', length: 10, nullable: true })
  ubicacion: string;

  @Column({ name: 'MAX', type: 'decimal', precision: 6, scale: 0, nullable: true })
  max: number;

  @Column({ name: 'CAPACIDAD', type: 'decimal', precision: 6, scale: 0, nullable: true })
  capacidad: number;

  @Column({ name: 'EXISTENCIA', type: 'decimal', precision: 10, scale: 3, nullable: true })
  existencia: number;

  @ManyToOne(() => InvLegacy, (articulo) => articulo.almacenes, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'ARTICULOID', referencedColumnName: 'articuloId' })
  articulo: InvLegacy;

  @ManyToOne(() => NomAlmLegacy, (nomAlmacen) => nomAlmacen.existencias, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'ALMACEN', referencedColumnName: 'almacen' })
  nomAlmacenRef: NomAlmLegacy;
}
