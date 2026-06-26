import {
  CreateDateColumn,
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ProductoPromoMes } from './producto-promo-mes.entity';

@Entity('catalogos')
@Unique('uq_catalogos_nombre_periodo', ['nombrePeriodo'])
export class CatalogoPromoMes {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'nombre_periodo', type: 'varchar', length: 120 })
  nombrePeriodo: string;

  @CreateDateColumn({ name: 'fecha_registro', type: 'timestamp' })
  fechaRegistro: Date;

  @OneToMany(() => ProductoPromoMes, (producto) => producto.catalogo)
  productos: ProductoPromoMes[];
}
