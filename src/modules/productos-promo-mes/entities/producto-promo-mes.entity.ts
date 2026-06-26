import {
  CreateDateColumn,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { CatalogoPromoMes } from './catalogo-promo-mes.entity';

@Entity('productos_promo_mes')
@Unique('uq_productos_promo_mes_catalogo_codigo', ['catalogoId', 'codigo'])
export class ProductoPromoMes {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'catalogo_id', type: 'int' })
  catalogoId: number;

  @ManyToOne(() => CatalogoPromoMes, (catalogo) => catalogo.productos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'catalogo_id' })
  catalogo: CatalogoPromoMes;

  @Column({ type: 'varchar', length: 40 })
  codigo: string;

  @Column({ name: 'en_catalogo', type: 'boolean', default: false })
  enCatalogo: boolean;

  @Column({ name: 'pagina_catalogo', type: 'int', nullable: true })
  paginaCatalogo: number | null;

  @Column({ name: 'fuera_de_catalogo', type: 'boolean', default: false })
  fueraDeCatalogo: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
