import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Personal } from './personal.entity';

@Entity('CLI')
export class Cliente {
  @PrimaryGeneratedColumn({ name: 'CLIENTEID' })
  clienteId: number;

  @Column({ name: 'TIPO', length: 1 })
  tipo: string;

  @Column({ name: 'DOMID' })
  domId: number;

  @Column({ name: 'NOMBRE', length: 100 })
  nombre: string;

  @Column({ name: 'CATALOGO', length: 1 })
  catalogo: string;

  @Column({ name: 'NUMERO', length: 5 })
  numero: string;

  @Column({ name: 'CLIACTDIC', length: 1 })
  cliActDic: string;

  @Column({ name: 'EXTERNO', length: 15 })
  externo: string;

  @Column({ name: 'ACTIVO', length: 1 })
  activo: string;

  @Column({ name: 'CLICOLOR' })
  cliColor: number;

  @Column({ name: 'SALDO', type: 'decimal', precision: 11, scale: 2 })
  saldo: number;

  @Column({ name: 'SALDOSBC', type: 'decimal', precision: 11, scale: 2 })
  saldoSbc: number;

  @Column({ name: 'FECHASBC', type: 'date' })
  fechaSbc: Date;

  @Column({ name: 'LIMITE', type: 'decimal', precision: 11, scale: 2 })
  limite: number;

  @Column({ name: 'DESCUENTO', type: 'decimal', precision: 6, scale: 2 })
  descuento: number;

  @Column({ name: 'DESCRED', type: 'decimal', precision: 6, scale: 2 })
  desCred: number;

  @Column({ name: 'LISTA' })
  lista: number;

  @Column({ name: 'LISTACR' })
  listaCr: number;

  @Column({ name: 'CUENTA', length: 20 })
  cuenta: string;

  @Column({ name: 'BANCORFC', length: 13 })
  bancoRfc: string;

  @Column({ name: 'BANCOEXT', length: 1 })
  bancoExt: string;

  @Column({ name: 'VENDEDOR', length: 2 })
  vendedor: string;

  @Column({ name: 'VENDEDORID' })
  vendedorId: number;

  @Column({ name: 'COBRADORID' })
  cobradorId: number;

  @Column({ name: 'FORCRE', length: 1 })
  forCre: string;

  @Column({ name: 'DIACREDITO' })
  diaCredito: number;

  @Column({ name: 'BASCALVEN', length: 1 })
  basCalVen: string;

  @Column({ name: 'DIAPRE', length: 7 })
  diaPre: string;

  @Column({ name: 'DIACOB', length: 7 })
  diaCob: string;

  @Column({ name: 'DIAVIS', length: 7 })
  diaVis: string;

  @Column({ name: 'PROVEN', type: 'date' })
  proVen: Date;

  @Column({ name: 'ULTCOM', type: 'date' })
  ultCom: Date;

  @Column({ name: 'FECALTCLI', type: 'date' })
  fecAltCli: Date;

  @Column({ name: 'PERIODO' })
  periodo: number;

  @Column({ name: 'EMISOR', length: 2 })
  emisor: string;

  @Column({ name: 'EMISORID' })
  emisorId: number;

  @Column({ name: 'CAMBIADO', type: 'timestamp' })
  cambiado: Date;

  @Column({ name: 'TRATO', length: 50 })
  trato: string;

  @Column({ name: 'OBSERVACIO', length: 60 })
  observacio: string;

  @Column({ name: 'IMPUESTOF', length: 1 })
  impuestoF: string;

  @Column({ name: 'IGNORASUSPENDER', type: 'date' })
  ignoraSuspender: Date;

  @Column({ name: 'PAGREF', length: 4 })
  pagRef: string;

  @Column({ name: 'FORPAG', length: 1 })
  forPag: string;

  @Column({ name: 'CLIUSOCFD', length: 3 })
  cliUsoCfd: string;

  @Column({ name: 'CLIDESIEPS', length: 1 })
  cliDesIeps: string;

  @Column({ name: 'XGPS', length: 45 })
  xGps: string;

  @Column({ name: 'XORIGEN', length: 1 })
  xOrigen: string;

  @Column({ name: 'XRUTA', length: 5 })
  xRuta: string;

  @Column({ name: 'XLIMITE2', type: 'decimal', precision: 10, scale: 0 })
  xLimite2: number;

  @Column({ name: 'XBONO0', type: 'decimal', precision: 9, scale: 2 })
  xBono0: number;

  @Column({ name: 'XBONO1', type: 'decimal', precision: 8, scale: 2 })
  xBono1: number;

  @Column({ name: 'XBONO2', type: 'decimal', precision: 8, scale: 2 })
  xBono2: number;

  @Column({ name: 'XBONO3', type: 'decimal', precision: 8, scale: 2 })
  xBono3: number;

  @Column({ name: 'XBONO4', type: 'decimal', precision: 8, scale: 2 })
  xBono4: number;

  @Column({ name: 'XBONO5', type: 'decimal', precision: 8, scale: 2 })
  xBono5: number;

  @Column({ name: 'XBONO6', type: 'decimal', precision: 8, scale: 2 })
  xBono6: number;

  @Column({ name: 'XBONO7', type: 'decimal', precision: 8, scale: 2 })
  xBono7: number;

  @Column({ name: 'XBONO8', type: 'decimal', precision: 8, scale: 2 })
  xBono8: number;

  @Column({ name: 'XBONO9', type: 'decimal', precision: 8, scale: 2 })
  xBono9: number;

  @Column({ name: 'XBONO10', type: 'decimal', precision: 8, scale: 2 })
  xBono10: number;

  @Column({ name: 'XBONO11', type: 'decimal', precision: 8, scale: 2 })
  xBono11: number;

  @Column({ name: 'XBONO12', type: 'decimal', precision: 8, scale: 2 })
  xBono12: number;

  @Column({ name: 'XLATITUD', length: 25 })
  xLatitud: string;

  @Column({ name: 'XLONGITUD', length: 25 })
  xLongitud: string;

  @Column({ name: 'XAPLBONO', length: 1 })
  xAplBono: string;

  @Column({ name: 'XWEB', length: 2 })
  xWeb: string;

  @ManyToOne(() => Personal, { 
    createForeignKeyConstraints: false
  })
  @JoinColumn({ 
    name: 'VENDEDORID',          // La columna en la tabla CLI
    referencedColumnName: 'perId' // La propiedad en la entidad Personal
  })
  vendedorDetalle: Personal;
}
