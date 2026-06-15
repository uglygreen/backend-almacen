import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { AlmLegacy } from './alm-legacy.entity';

@Entity('NOMALM')
export class NomAlmLegacy {
  @PrimaryColumn({ name: 'ALMACEN', type: 'smallint', unsigned: true })
  almacen: number;

  @Column({ name: 'NOMALMACEN', type: 'char', length: 15, nullable: true })
  nomAlmacen: string;

  @Column({ name: 'ACTIVO', type: 'char', length: 15, nullable: true })
  activo: string;

  @Column({ name: 'NAGRUPO', type: 'char', length: 1, nullable: true })
  naGrupo: string;

  @Column({ name: 'ALMPRODUCCION', type: 'char', length: 1, nullable: true })
  almProduccion: string;

  @Column({ name: 'USAALMDEF', type: 'char', length: 1, nullable: true })
  usaAlmDef: string;

  @Column({ name: 'UNIDADXALM', type: 'varchar', length: 50, nullable: true })
  unidadXAlm: string;

  @Column({ name: 'ALMDOMID', type: 'int', unsigned: true, nullable: true })
  almDomId: number;

  @Column({ name: 'ALMSUCID', type: 'int', unsigned: true, nullable: true })
  almSucId: number;

  @OneToMany(() => AlmLegacy, (almacenArticulo) => almacenArticulo.nomAlmacenRef, {
    createForeignKeyConstraints: false,
  })
  existencias: AlmLegacy[];
}
