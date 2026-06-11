import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { PersonnelEmployee } from './personnel-employee.entity';

@Entity('personnel_position')
export class PersonnelPosition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'position_code', type: 'varchar' })
  position_code: string;

  @Column({ name: 'position_name', type: 'varchar' })
  position_name: string;

  @Column({ name: 'is_default', type: 'boolean' })
  is_default: boolean;

  @Column({ name: 'company_id', type: 'integer', nullable: true })
  company_id: number;

  @Column({ name: 'parent_position_id', type: 'integer', nullable: true })
  parent_position_id: number;

  @OneToMany(() => PersonnelEmployee, (employee) => employee.position)
  employees: PersonnelEmployee[];

  // Relación consigo misma para obtener el padre
  @ManyToOne(() => PersonnelPosition)
  @JoinColumn({ name: 'parent_position_id' })
  parent_position: PersonnelPosition;
}
