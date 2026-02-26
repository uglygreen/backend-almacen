import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('PER') // Nombre exacto de la tabla en tu base de datos
export class Personal {
  @PrimaryGeneratedColumn({ name: 'PERID', type: 'int', unsigned: true })
  perId: number;

  @Column({ name: 'CATEGORIA', type: 'char', length: 2 })
  categoria: string;

  @Column({ name: 'GRUPO', type: 'char', length: 2 })
  grupo: string;

  @Column({ name: 'NOMBRE', type: 'varchar', length: 50 })
  nombre: string;

  @Column({ name: 'PERPRMID', type: 'int', unsigned: true, default: 0 })
  perPrmId: number;

  @Column({ name: 'PERFIL', type: 'varchar', length: 50 })
  perfil: string;

  @Column({ name: 'ESTADO', type: 'char', length: 1, default: 'A' })
  estado: string;

  @Column({ name: 'COSTO', type: 'decimal', precision: 8, scale: 3, default: 0.000 })
  costo: number;

  @Column({ name: 'ALMACEN', type: 'smallint', unsigned: true, default: 0 })
  almacen: number;

  @Column({ name: 'CATCLI', type: 'varchar', length: 15, default: '0' })
  catCli: string;

  @Column({ name: 'CATPRO', type: 'varchar', length: 15, default: '0' })
  catPro: string;

  @Column({ name: 'CATINV', type: 'varchar', length: 15, default: '0' })
  catInv: string;

  @Column({ name: 'DIAS', type: 'char', length: 7, default: '' })
  dias: string;

  @Column({ name: 'MODIFICADO', type: 'char', length: 1, default: '' })
  modificado: string;

  @Column({ name: 'CAJA', type: 'smallint', unsigned: true, default: 0 })
  caja: number;

  // --- Series Documentales ---
  @Column({ name: 'SERNOT', type: 'char', length: 15, default: '+' })
  serNot: string;

  @Column({ name: 'SERFAC', type: 'char', length: 15, default: '+' })
  serFac: string;

  @Column({ name: 'SERCOT', type: 'char', length: 15, default: '+' })
  serCot: string;

  @Column({ name: 'SERCOM', type: 'char', length: 15, default: '+' })
  serCom: string;

  @Column({ name: 'SERORD', type: 'char', length: 15, default: '+' })
  serOrd: string;

  @Column({ name: 'SERMOV', type: 'char', length: 15, default: '+' })
  serMov: string;

  @Column({ name: 'SERNCR', type: 'char', length: 15, default: '+' })
  serNcr: string;

  @Column({ name: 'SERNCF', type: 'char', length: 15, default: '+' })
  serNcf: string;

  @Column({ name: 'SERMER', type: 'char', length: 15, default: '+' })
  serMer: string;

  @Column({ name: 'SERINV', type: 'char', length: 15, default: '+' })
  serInv: string;

  @Column({ name: 'SERNCP', type: 'char', length: 15, default: '+' })
  serNcp: string;

  @Column({ name: 'SEREMB', type: 'varchar', length: 15, default: '+' })
  serEmb: string;

  // --- Configuraciones y Módulos ---
  @Column({ name: 'PERSCBID', type: 'int', unsigned: true, default: 0 })
  perScbId: number;

  @Column({ name: 'MODIMP', type: 'char', length: 1, default: 'T' })
  modImp: string;

  @Column({ name: 'MODIMPF', type: 'char', length: 1, default: 'T' })
  modImpf: string;

  @Column({ name: 'TIPACC', type: 'char', length: 1, default: 'D' })
  tipAcc: string;

  @Column({ name: 'VALSIS', type: 'varchar', length: 39, default: '' })
  valSis: string;

  @Column({ name: 'NIVEL', type: 'text', nullable: true })
  nivel: string;

  @Column({ name: 'GRUREP', type: 'char', length: 10, default: '' })
  gruRep: string;

  @Column({ name: 'NIVREP', type: 'char', length: 1, default: '' })
  nivRep: string;

  @Column({ name: 'PERGRUCRM', type: 'varchar', length: 10, default: '' })
  perGruCrm: string;

  @Column({ name: 'TERM', type: 'varchar', length: 30, default: '' })
  term: string;

  @Column({ name: 'HORA', type: 'char', length: 4, default: '' })
  hora: string;

  @Column({ name: 'BASE', type: 'char', length: 10, default: '' })
  base: string;

  @Column({ name: 'DATO', type: 'char', length: 4, default: '' })
  dato: string;

  // --- Estados e IDs relacionados ---
  @Column({ name: 'STAINVID', type: 'int', unsigned: true, default: 0 })
  staInvId: number;

  @Column({ name: 'STAARTDOCID', type: 'int', unsigned: true, default: 0 })
  staArtDocId: number;

  @Column({ name: 'STACLIID', type: 'int', unsigned: true, default: 0 })
  staCliId: number;

  @Column({ name: 'STADOMID', type: 'int', unsigned: true, default: 0 })
  staDomId: number;

  @Column({ name: 'STADOCID', type: 'int', unsigned: true, default: 0 })
  staDocId: number;

  @Column({ name: 'STABANID', type: 'int', unsigned: true, default: 0 })
  staBanId: number;

  @Column({ name: 'STACAJID', type: 'int', unsigned: true, default: 0 })
  staCajId: number;

  @Column({ name: 'STACUEID', type: 'int', unsigned: true, default: 0 })
  staCueId: number;

  @Column({ name: 'STADESID', type: 'int', unsigned: true, default: 0 })
  staDesId: number;

  @Column({ name: 'STAPAQID', type: 'int', unsigned: true, default: 0 })
  staPaqId: number;

  @Column({ name: 'STADESCUEID', type: 'int', unsigned: true, default: 0 })
  staDesCueId: number;

  @Column({ name: 'STASERID', type: 'int', unsigned: true, default: 0 })
  staSerId: number;

  // --- Emisor, Horarios y Límites ---
  @Column({ name: 'EMISOR', type: 'char', length: 2, default: '' })
  emisor: string;

  @Column({ name: 'EMISORID', type: 'int', unsigned: true, default: 0 })
  emisorId: number;

  @Column({ name: 'HOR1', type: 'varchar', length: 16, default: '' })
  hor1: string;

  @Column({ name: 'DIA1', type: 'varchar', length: 7, default: '' })
  dia1: string;

  @Column({ name: 'HOR2', type: 'varchar', length: 16, default: '' })
  hor2: string;

  @Column({ name: 'DIA2', type: 'varchar', length: 7, default: '' })
  dia2: string;

  @Column({ name: 'TOLERANCIA', type: 'decimal', precision: 3, scale: 0, default: 0 })
  tolerancia: number;

  @Column({ name: 'LIMITEVENCIDO', type: 'decimal', precision: 5, scale: 0, default: 0 })
  limiteVencido: number;

  @Column({ name: 'LIMITEEXCEDIDO', type: 'decimal', precision: 5, scale: 0, default: 0 })
  limiteExcedido: number;

  @Column({ name: 'CLASEC', type: 'varchar', length: 8, default: '' })
  claseC: string;

  @Column({ name: 'LIMDES', type: 'decimal', precision: 4, scale: 2, default: 0.00 })
  limDes: number;

  @Column({ name: 'PERFORPAG', type: 'varchar', length: 10, default: '' })
  perForPag: string;

  // --- Configuraciones de Correo ---
  @Column({ name: 'CERESPONDE', type: 'varchar', length: 45, default: '' })
  ceResponde: string;

  @Column({ name: 'CECORREO', type: 'varchar', length: 45, default: '' })
  ceCorreo: string;

  @Column({ name: 'CESERVIDOR', type: 'varchar', length: 70, default: '' })
  ceServidor: string;

  @Column({ name: 'CEUSUARIO', type: 'varchar', length: 45, default: '' })
  ceUsuario: string;

  @Column({ name: 'CECLAVE', type: 'varchar', length: 128, default: '' })
  ceClave: string;

  @Column({ name: 'CEPUERTO', type: 'decimal', precision: 5, scale: 0, default: 0 })
  cePuerto: number;

  @Column({ name: 'CEREENVIO', type: 'char', length: 1, default: '' })
  ceReenvio: string;

  // --- Mensajes y Sucursal ---
  @Column({ name: 'FECMSG', type: 'date', default: () => "'0000-00-00'" })
  fecMsg: Date;

  @Column({ name: 'HORMSG', type: 'varchar', length: 8, default: '' })
  horMsg: string;

  @Column({ name: 'PERPRECIOS', type: 'char', length: 10, default: '' })
  perPrecios: string;

  @Column({ name: 'PERGPOCE', type: 'char', length: 10, default: '' })
  perGpoCe: string;

  @Column({ name: 'SUCURSAL', type: 'int', unsigned: true, default: 0 })
  sucursal: number;

  @Column({ name: 'SUPERIOR', type: 'char', length: 2, default: '' })
  superior: string;

  @Column({ name: 'NUEMENSAJE', type: 'decimal', precision: 4, scale: 0, default: 0 })
  nueMensaje: number;

  // --- Datos Personales / Ubicación ---
  @Column({ name: 'DIRECCION', type: 'varchar', length: 40, default: '' })
  direccion: string;

  @Column({ name: 'COLONIA', type: 'varchar', length: 25, default: '' })
  colonia: string;

  @Column({ name: 'CIUDAD', type: 'varchar', length: 30, default: '' })
  ciudad: string;

  @Column({ name: 'TEL1', type: 'varchar', length: 12, default: '' })
  tel1: string;

  @Column({ name: 'TTEL1', type: 'char', length: 1, default: '' })
  ttel1: string;

  @Column({ name: 'CTEL1', type: 'varchar', length: 10, default: '' })
  ctel1: string;

  @Column({ name: 'TEL2', type: 'varchar', length: 12, default: '' })
  tel2: string;

  @Column({ name: 'TTEL2', type: 'char', length: 1, default: '' })
  ttel2: string;

  @Column({ name: 'CTEL2', type: 'varchar', length: 10, default: '' })
  ctel2: string;

  @Column({ name: 'CP', type: 'char', length: 5, default: '' })
  cp: string;

  @Column({ name: 'RFC', type: 'varchar', length: 13, default: '' })
  rfc: string;

  @Column({ name: 'CURP', type: 'varchar', length: 18, default: '' })
  curp: string;

  @Column({ name: 'INGRESO', type: 'date', default: () => "'0000-00-00'" })
  ingreso: Date;

  // Modificado automáticamente por MySQL "on update current_timestamp()"
  @UpdateDateColumn({ name: 'CAMBIADO', type: 'timestamp' })
  cambiado: Date;

  // --- Otros ---
  @Column({ name: 'XSMS', type: 'decimal', precision: 1, scale: 0, default: 0 })
  xsms: number;

  @Column({ name: 'XCORTE', type: 'char', length: 1, default: '' })
  xCorte: string;

  @Column({ name: 'XCATEGORIA', type: 'char', length: 5, default: '' })
  xCategoria: string;
}