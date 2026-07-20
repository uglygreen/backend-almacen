import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import type { Relation } from 'typeorm';

import { IclockTransaction } from './iclock-transaction.entity';
import { AttLeave } from './att-leave.entity';
import { PersonnelDepartment } from './personnel-department.entity';
import { PersonnelPosition } from './personnel-position.entity';
import { PersonnelResign } from './personnel-resign.entity';

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

  @Column({ name: 'hire_date', type: 'date', nullable: true })
  hire_date: string | null;

  // Relación con el departamento
  @ManyToOne(() => PersonnelDepartment, (department) => department.employees)
  @JoinColumn({ name: 'department_id' })
  department: Relation<PersonnelDepartment>;

  // Relación con la posición
  @ManyToOne(() => PersonnelPosition, (position) => position.employees)
  @JoinColumn({ name: 'position_id' })
  position: Relation<PersonnelPosition>;

  // Relación con transacciones
  @OneToMany(() => IclockTransaction, (transaction) => transaction.employee)
  transactions: Relation<IclockTransaction[]>;

  @OneToMany(() => AttLeave, (leave) => leave.employee)
  leaves: Relation<AttLeave[]>;

  @OneToMany(() => PersonnelResign, (resignation) => resignation.employee)
  resignations: Relation<PersonnelResign[]>;
}
