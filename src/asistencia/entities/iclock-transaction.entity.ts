import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PersonnelEmployee } from './personnel-employee.entity';

@Entity('iclock_transaction')
export class IclockTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'emp_code', type: 'varchar' })
  emp_code: string;

  @Column({ name: 'punch_time', type: 'timestamp with time zone' })
  punch_time: Date;

  @Column({ name: 'punch_state', type: 'varchar' })
  punch_state: string;

  @Column({ name: 'verify_type', type: 'integer' })
  verify_type: number;

  @Column({ name: 'work_code', type: 'varchar', nullable: true })
  work_code: string;

  @Column({ name: 'terminal_sn', type: 'varchar', nullable: true })
  terminal_sn: string;

  @Column({ name: 'terminal_alias', type: 'varchar', nullable: true })
  terminal_alias: string;

  @Column({ name: 'area_alias', type: 'varchar', nullable: true })
  area_alias: string;

  @Column({ name: 'longitude', type: 'double precision', nullable: true })
  longitude: number;

  @Column({ name: 'latitude', type: 'double precision', nullable: true })
  latitude: number;

  @Column({ name: 'gps_location', type: 'text', nullable: true })
  gps_location: string;

  @Column({ name: 'mobile', type: 'varchar', nullable: true })
  mobile: string;

  @Column({ name: 'source', type: 'smallint', nullable: true })
  source: number;

  @Column({ name: 'purpose', type: 'smallint', nullable: true })
  purpose: number;

  @Column({ name: 'crc', type: 'varchar', nullable: true })
  crc: string;

  @Column({ name: 'is_attendance', type: 'smallint', nullable: true })
  is_attendance: number;

  @Column({ name: 'reserved', type: 'varchar', nullable: true })
  reserved: string;

  @Column({ name: 'upload_time', type: 'timestamp with time zone', nullable: true })
  upload_time: Date;

  @Column({ name: 'sync_status', type: 'smallint', nullable: true })
  sync_status: number;

  @Column({ name: 'sync_time', type: 'timestamp with time zone', nullable: true })
  sync_time: Date;

  @Column({ name: 'is_mask', type: 'smallint', nullable: true })
  is_mask: number;

  @Column({ name: 'temperature', type: 'numeric', nullable: true })
  temperature: number;

  @Column({ name: 'emp_id', type: 'integer', nullable: true })
  emp_id: number;

  @Column({ name: 'terminal_id', type: 'integer', nullable: true })
  terminal_id: number;

  // Relación con el empleado
  @ManyToOne(() => PersonnelEmployee, (employee) => employee.transactions)
  @JoinColumn({ name: 'emp_id' })
  employee: PersonnelEmployee;
}
