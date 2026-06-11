import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { InvLegacy } from './inv-legacy.entity';

@Entity('UNIDADES')
export class UnidadLegacy {
  @PrimaryColumn({ name: 'UNIDADID', type: 'int', unsigned: true })
  unidadId: number;

  @PrimaryColumn({ name: 'ARTICULOID', type: 'int', unsigned: true })
  articuloId: number;

  @Column({ name: 'NUNIDAD', type: 'smallint', unsigned: true, nullable: true })
  nUnidad: number;

  @Column({ name: 'UNIDAD', type: 'char', length: 2, nullable: true })
  unidad: string;

  @Column({ name: 'UACTIVA', type: 'char', length: 1, nullable: true })
  uActiva: string;

  @Column({ name: 'UEQUIVALE', type: 'decimal', precision: 8, scale: 3, nullable: true })
  uEquivale: number;

  @OneToMany(() => InvLegacy, (articulo) => articulo.unidadBase, {
    createForeignKeyConstraints: false,
  })
  articulosBase: InvLegacy[];
}
