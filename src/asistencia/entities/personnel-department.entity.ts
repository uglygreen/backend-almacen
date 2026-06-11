import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { PersonnelEmployee } from './personnel-employee.entity';

@Entity('personnel_department')
export class PersonnelDepartment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'dept_code', type: 'varchar' })
  dept_code: string;

  @Column({ name: 'dept_name', type: 'varchar' })
  dept_name: string;

  @Column({ name: 'is_default', type: 'boolean' })
  is_default: boolean;

  @Column({ name: 'company_id', type: 'integer', nullable: true })
  company_id: number;

  @Column({ name: 'parent_dept_id', type: 'integer', nullable: true })
  parent_dept_id: number;

  @OneToMany(() => PersonnelEmployee, (employee) => employee.department)
  employees: PersonnelEmployee[];
}
