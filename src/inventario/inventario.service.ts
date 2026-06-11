import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class InventarioService {
  constructor(
    @InjectDataSource('legacy_db')
    private readonly legacyDataSource: DataSource,
  ) {}

  async obtenerInfoArticulo(articuloid: number) {
    // Query 1: ULTIMA from inv
    const ultimaResult = await this.legacyDataSource.query(
      'select ULTIMA from inv where ARTICULOID = ?',
      [articuloid],
    );

    // Query 2: EXISTENCIA from alm
    const existenciaResult = await this.legacyDataSource.query(
      'select EXISTENCIA from alm where ARTICULOID = ? and ALMACEN = 1',
      [articuloid],
    );

    // Get the values safely.
    // We assume the DB driver returns objects with properties matching the SELECT clause.
    // If the record doesn't exist, we return default values (null for date, 0 for stock).
    
    const ultima = ultimaResult.length > 0 ? ultimaResult[0].ULTIMA : null;
    const existencia = existenciaResult.length > 0 ? existenciaResult[0].EXISTENCIA : 0;

    return {
      ultima,
      existencia,
    };
  }

  async obtenerUltimaEntregaProveedor(clvprov: string) {
    const claveProveedor = (clvprov ?? '').trim();
    if (!claveProveedor) {
      return null;
    }

    const results = await this.legacyDataSource.query(
      `
        SELECT
          des.DESID,
          des.DESFECHA,
          des.DESCANTIDAD,
          des.DESENTREGADO,
          inv.ARTICULOID,
          inv.DESCRIPCIO,
          inv.CLAVE,
          inv.CLVPROV,
          alm.EXISTENCIA,
          alm.UBICACION,
          inv.XIMAGEN2,
          inv.XMCA_IMAG,
          inv.XXMARCA
        FROM DES des
        INNER JOIN INV inv
          ON inv.ARTICULOID = des.DESARTID
        LEFT JOIN ALM alm
          ON alm.ARTICULOID = inv.ARTICULOID
          AND alm.ALMACEN = 1
        WHERE des.DESTIPO = 'E'
          AND TRIM(inv.CLVPROV) = ?
        ORDER BY des.DESFECHA DESC, des.DESHORA DESC, des.DESID DESC
        LIMIT 1
      `,
      [claveProveedor],
    );

    if (!results.length) {
      return null;
    }

    const row = results[0];
    return {
      DESID: row.DESID,
      DESFECHA: row.DESFECHA,
      DESCANTIDAD: row.DESCANTIDAD,
      DESENTREGADO: row.DESENTREGADO,
      ARTICULOID: row.ARTICULOID,
      DESCRIPCIO: row.DESCRIPCIO,
      CLAVE: row.CLAVE,
      CLVPROV: row.CLVPROV,
      EXISTENCIA: row.EXISTENCIA ?? 0,
      UBICACION: row.UBICACION ?? null,
      XIMAGEN2: row.XIMAGEN2,
      XMCA_IMAG: row.XMCA_IMAG,
      XXMARCA: row.XXMARCA,
    };
  }
}
