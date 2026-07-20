import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { AttLeave } from './att-leave.entity';

@Entity('att_leavecategory')
export class AttLeaveCategory {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'category_name', type: 'varchar' })
  category_name: string;

  @Column({ name: 'minimum_unit', type: 'double precision' })
  minimum_unit: number;

  @Column({ name: 'unit', type: 'smallint' })
  unit: number;

  @Column({ name: 'round_off', type: 'smallint' })
  round_off: number;

  @Column({ name: 'report_symbol', type: 'varchar' })
  report_symbol: string;

  @Column({ name: 'leave_category_type', type: 'smallint' })
  leave_category_type: number;

  @OneToMany(() => AttLeave, (leave) => leave.category)
  leaves: Relation<AttLeave[]>;
}
