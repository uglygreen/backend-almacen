import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Cliente } from './cliente.entity';
import { DocLegacy } from './doc-legacy.entity';
import { Personal } from './personal.entity';

@Entity('DOM')
export class DomLegacy {
  @PrimaryGeneratedColumn({ name: 'DOMID', type: 'int', unsigned: true })
  domId: number;

  @Column({ name: 'CLIENTEID', type: 'int', unsigned: true, nullable: true })
  clienteId: number;

  @Column({ name: 'NOMBRE', type: 'varchar', length: 100, nullable: true })
  nombre: string;

  @Column({ name: 'NOMBRECOM', type: 'varchar', length: 100, nullable: true })
  nombreCom: string;

  @Column({ name: 'DIRECCION', type: 'varchar', length: 40, nullable: true })
  direccion: string;

  @Column({ name: 'NUMERO', type: 'char', length: 7, nullable: true })
  numero: string;

  @Column({ name: 'INTERIOR', type: 'char', length: 7, nullable: true })
  interior: string;

  @Column({ name: 'COLONIA', type: 'varchar', length: 25, nullable: true })
  colonia: string;

  @Column({ name: 'DOMCOLONIAID', type: 'int', unsigned: true, nullable: true })
  domColoniaId: number;

  @Column({ name: 'CIUDAD', type: 'varchar', length: 30, nullable: true })
  ciudad: string;

  @Column({ name: 'DOMLOCALIDADID', type: 'int', unsigned: true, nullable: true })
  domLocalidadId: number;

  @Column({ name: 'MUNICIPIO', type: 'varchar', length: 27, nullable: true })
  municipio: string;

  @Column({ name: 'DOMMUNICIPIOID', type: 'int', unsigned: true, nullable: true })
  domMunicipioId: number;

  @Column({ name: 'ESTADO', type: 'char', length: 5, nullable: true })
  estado: string;

  @Column({ name: 'PAIS', type: 'varchar', length: 10, nullable: true })
  pais: string;

  @Column({ name: 'REFERENCIA', type: 'varchar', length: 20, nullable: true })
  referencia: string;

  @Column({ name: 'CP', type: 'char', length: 5, nullable: true })
  cp: string;

  @Column({ name: 'RFC', type: 'char', length: 13, nullable: true })
  rfc: string;

  @Column({ name: 'DOMREGIMEN', type: 'char', length: 3, nullable: true })
  domRegimen: string;

  @Column({ name: 'CURP', type: 'char', length: 18, nullable: true })
  curp: string;

  @Column({ name: 'MEDIO', type: 'varchar', length: 15, nullable: true })
  medio: string;

  @Column({ name: 'EMISOR', type: 'char', length: 2, nullable: true })
  emisor: string;

  @Column({ name: 'EMISORID', type: 'int', unsigned: true, nullable: true })
  emisorId: number;

  @Column({ name: 'DOMDISTANCIA', type: 'smallint', unsigned: true, nullable: true })
  domDistancia: number;

  @Column({ name: 'TRATO', type: 'varchar', length: 50, nullable: true })
  trato: string;

  @Column({ name: 'CAMBIADO', type: 'timestamp', nullable: true })
  cambiado: Date;

  @Column({ name: 'VALIDADO', type: 'char', length: 1, nullable: true })
  validado: string;

  @Column({ name: 'DOMLATITUD', type: 'decimal', precision: 11, scale: 6, nullable: true })
  domLatitud: number;

  @Column({ name: 'DOMLONGITUD', type: 'decimal', precision: 11, scale: 6, nullable: true })
  domLongitud: number;

  @Column({ name: 'XZONAD', type: 'char', length: 2, nullable: true })
  xZonaD: string;

  @ManyToOne(() => Cliente, (cliente) => cliente.domicilios, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'CLIENTEID', referencedColumnName: 'clienteId' })
  cliente: Cliente;

  @ManyToOne(() => Personal, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'EMISORID', referencedColumnName: 'perId' })
  emisorDetalle: Personal;

  @OneToMany(() => DocLegacy, (doc) => doc.domicilioDocumento, {
    createForeignKeyConstraints: false,
  })
  documentosComoDomDoc: DocLegacy[];
}
