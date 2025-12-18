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
}
