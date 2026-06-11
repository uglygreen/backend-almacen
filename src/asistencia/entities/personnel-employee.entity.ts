import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

import { IclockTransaction } from './iclock-transaction.entity';
import { PersonnelDepartment } from './personnel-department.entity';
import { PersonnelPosition } from './personnel-position.entity';

@Entity('personnel_employee')
export class PersonnelEmployee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'emp_code', type: 'bigint' })
  emp_code: string;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  first_name: string;

  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  last_name: string;

  @Column({ name: 'status', type: 'smallint' })
  status: number;

  @Column({ name: 'department_id', type: 'integer', nullable: true })
  department_id: number;

  @Column({ name: 'position_id', type: 'integer', nullable: true })
  position_id: number;

  // Relación con el departamento
  @ManyToOne(() => PersonnelDepartment, (department) => department.employees)
  @JoinColumn({ name: 'department_id' })
  department: PersonnelDepartment;

  // Relación con la posición
  @ManyToOne(() => PersonnelPosition, (position) => position.employees)
  @JoinColumn({ name: 'position_id' })
  position: PersonnelPosition;

  // Relación con transacciones
  @OneToMany(() => IclockTransaction, (transaction) => transaction.employee)
  transactions: IclockTransaction[];
}
