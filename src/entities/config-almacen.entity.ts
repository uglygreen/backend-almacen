import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('config_almacen')
export class ConfigAlmacen {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'fecha_min', type: 'date' })
  fechaMin: string; // TypeORM can handle dates as strings 'YYYY-MM-DD'

  @Column({ name: 'fecha_max', type: 'date' })
  fechaMax: string;

  @Column({ name: 'modo_actualizacion', type: 'varchar', length: 20, default: 'manual' })
  modoActualizacion: string; // 'hoy', 'dos_dias', 'rango', 'manual'
}
