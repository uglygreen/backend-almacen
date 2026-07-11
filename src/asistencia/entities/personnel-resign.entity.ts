import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { PersonnelEmployee } from './personnel-employee.entity';

@Entity('personnel_resign')
export class PersonnelResign {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'resign_date', type: 'date' })
  resign_date: string;

  @Column({ name: 'resign_type', type: 'integer', nullable: true })
  resign_type: number | null;

  @Column({ name: 'disableatt', type: 'boolean' })
  disableatt: boolean;

  @Column({ name: 'reason', type: 'varchar', nullable: true })
  reason: string | null;

  @Column({ name: 'company_id', type: 'integer', nullable: true })
  company_id: number | null;

  @Column({ name: 'employee_id', type: 'integer' })
  employee_id: number;

  @ManyToOne(() => PersonnelEmployee, (employee) => employee.resignations, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'employee_id' })
  employee: Relation<PersonnelEmployee>;
}
