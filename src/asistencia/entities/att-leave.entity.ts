import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { AttLeaveCategory } from './att-leave-category.entity';
import { PersonnelEmployee } from './personnel-employee.entity';

@Entity('att_leave')
export class AttLeave {
  @PrimaryColumn({ name: 'abstractexception_ptr_id', type: 'integer' })
  abstractexception_ptr_id: number;

  @Column({ name: 'start_time', type: 'timestamp with time zone' })
  start_time: Date;

  @Column({ name: 'end_time', type: 'timestamp with time zone' })
  end_time: Date;

  @Column({ name: 'type', type: 'smallint' })
  leave_type: number;

  @Column({ name: 'apply_reason', type: 'text', nullable: true })
  apply_reason: string | null;

  @Column({ name: 'apply_time', type: 'timestamp with time zone' })
  apply_time: Date;

  @Column({ name: 'audit_reason', type: 'text', nullable: true })
  audit_reason: string | null;

  @Column({ name: 'audit_time', type: 'timestamp with time zone' })
  audit_time: Date;

  @Column({ name: 'approval_level', type: 'smallint', nullable: true })
  approval_level: number | null;

  @Column({ name: 'audit_user_id', type: 'integer', nullable: true })
  audit_user_id: number | null;

  @Column({ name: 'approver', type: 'varchar', nullable: true })
  approver: string | null;

  @Column({ name: 'vacation_number', type: 'smallint' })
  vacation_number: number;

  @Column({ name: 'attachment', type: 'varchar', nullable: true })
  attachment: string | null;

  @Column({ name: 'category_id', type: 'integer' })
  category_id: number;

  @Column({ name: 'employee_id', type: 'integer' })
  employee_id: number;

  @ManyToOne(() => AttLeaveCategory, (category) => category.leaves, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'category_id' })
  category: Relation<AttLeaveCategory>;

  @ManyToOne(() => PersonnelEmployee, (employee) => employee.leaves, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'employee_id' })
  employee: Relation<PersonnelEmployee>;
}
