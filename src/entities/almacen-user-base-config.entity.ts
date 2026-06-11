import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('almacen_user_base_config')
@Unique('uq_almacen_user_base_config_area_seccion', ['area', 'seccion'])
export class AlmacenUserBaseConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 30 })
  area: string;

  @Column({ length: 30 })
  seccion: string;

  @Column({ name: 'base_personal', type: 'int' })
  basePersonal: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
