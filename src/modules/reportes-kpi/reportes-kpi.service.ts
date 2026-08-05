import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GetKpiVentasPorEstadoDto } from './dto/get-kpi-ventas-por-estado.dto';

type VentaPorEstadoRow = {
  estado: string | null;
  facturas: number | string | null;
  clientes: number | string | null;
  ventas: number | string | null;
};

type VentaPorEstadoMensualRow = VentaPorEstadoRow & {
  anio: number | string | null;
  mes: number | string | null;
  periodo: string | null;
};

type VentaPorEmisorRow = {
  emisorId: number | string | null;
  emisor: string | null;
  facturas: number | string | null;
  clientes: number | string | null;
  ventas: number | string | null;
};

@Injectable()
export class ReportesKpiService {
  constructor(
    @InjectDataSource('legacy_db')
    private readonly legacyDataSource: DataSource,
  ) {}

  async getVentasPorEstado(query: GetKpiVentasPorEstadoDto) {
    const window = this.resolveWindow(query.fechaInicio, query.fechaFin);
    const soloTimbradas = this.parseBooleanFlag(query.soloTimbradas);
    const timbradasFilter = this.buildTimbradasFilter(soloTimbradas);

    const rows = await this.legacyDataSource.query(
      `
      SELECT
        ${this.buildEstadoCaseExpression('base.raw_estado')} AS estado,
        COUNT(*) AS facturas,
        COUNT(DISTINCT base.cliente_id) AS clientes,
        ROUND(SUM(base.total), 2) AS ventas
      FROM (
        ${this.buildFacturasBaseQuery(timbradasFilter)}
      ) base
      GROUP BY estado
      ORDER BY ventas DESC, facturas DESC, estado ASC
      `,
      [window.fechaInicio, window.fechaFin],
    );

    const items = (rows as VentaPorEstadoRow[]).map((row) => ({
      estado: row.estado ?? 'Sin estado',
      ventas: this.toMoney(row.ventas),
      facturas: this.toNumber(row.facturas),
      clientes: this.toNumber(row.clientes),
    }));

    return {
      window,
      filters: {
        soloTimbradas,
      },
      summary: {
        totalEstados: items.length,
        totalVentas: this.toMoney(items.reduce((sum, item) => sum + item.ventas, 0)),
        totalFacturas: items.reduce((sum, item) => sum + item.facturas, 0),
        totalClientesAgrupados: items.reduce((sum, item) => sum + item.clientes, 0),
      },
      items,
    };
  }

  async getVentasPorEstadoMensual(query: GetKpiVentasPorEstadoDto) {
    const window = this.resolveWindow(query.fechaInicio, query.fechaFin);
    const soloTimbradas = this.parseBooleanFlag(query.soloTimbradas);
    const timbradasFilter = this.buildTimbradasFilter(soloTimbradas);

    const rows = await this.legacyDataSource.query(
      `
      SELECT
        YEAR(base.fecha) AS anio,
        MONTH(base.fecha) AS mes,
        DATE_FORMAT(base.fecha, '%Y-%m') AS periodo,
        ${this.buildEstadoCaseExpression('base.raw_estado')} AS estado,
        COUNT(*) AS facturas,
        COUNT(DISTINCT base.cliente_id) AS clientes,
        ROUND(SUM(base.total), 2) AS ventas
      FROM (
        ${this.buildFacturasBaseQuery(timbradasFilter)}
      ) base
      GROUP BY anio, mes, periodo, estado
      ORDER BY anio ASC, mes ASC, ventas DESC, facturas DESC, estado ASC
      `,
      [window.fechaInicio, window.fechaFin],
    );

    const items = (rows as VentaPorEstadoMensualRow[]).map((row) => ({
      anio: this.toNumber(row.anio),
      mes: this.toNumber(row.mes),
      mesNombre: this.getMonthName(this.toNumber(row.mes)),
      periodo: row.periodo ?? '',
      estado: row.estado ?? 'Sin estado',
      ventas: this.toMoney(row.ventas),
      facturas: this.toNumber(row.facturas),
      clientes: this.toNumber(row.clientes),
    }));

    const monthsMap = new Map<
      string,
      {
        anio: number;
        mes: number;
        mesNombre: string;
        periodo: string;
        totalVentas: number;
        totalFacturas: number;
        totalClientesAgrupados: number;
        items: typeof items;
      }
    >();

    for (const item of items) {
      const current = monthsMap.get(item.periodo) ?? {
        anio: item.anio,
        mes: item.mes,
        mesNombre: item.mesNombre,
        periodo: item.periodo,
        totalVentas: 0,
        totalFacturas: 0,
        totalClientesAgrupados: 0,
        items: [],
      };

      current.totalVentas = this.toMoney(current.totalVentas + item.ventas);
      current.totalFacturas += item.facturas;
      current.totalClientesAgrupados += item.clientes;
      current.items.push(item);
      monthsMap.set(item.periodo, current);
    }

    const months = Array.from(monthsMap.values()).map((month) => ({
      ...month,
      totalVentas: this.toMoney(month.totalVentas),
    }));

    return {
      window,
      filters: {
        soloTimbradas,
      },
      summary: {
        totalMeses: months.length,
        totalRegistros: items.length,
        totalVentas: this.toMoney(items.reduce((sum, item) => sum + item.ventas, 0)),
        totalFacturas: items.reduce((sum, item) => sum + item.facturas, 0),
      },
      months,
    };
  }

  async getVentasPorEmisor(query: GetKpiVentasPorEstadoDto) {
    const window = this.resolveWindow(query.fechaInicio, query.fechaFin);
    const soloTimbradas = this.parseBooleanFlag(query.soloTimbradas);
    const timbradasFilter = this.buildTimbradasFilter(soloTimbradas);

    const rows = await this.legacyDataSource.query(
      `
      SELECT
        base.emisor_id AS emisorId,
        COALESCE(NULLIF(TRIM(per.NOMBRE), ''), CONCAT('Emisor ', base.emisor_id)) AS emisor,
        COUNT(*) AS facturas,
        COUNT(DISTINCT base.cliente_id) AS clientes,
        ROUND(SUM(base.total), 2) AS ventas
      FROM (
        ${this.buildFacturasBaseQuery(timbradasFilter)}
      ) base
      LEFT JOIN PER per
        ON per.PERID = base.emisor_id
      GROUP BY base.emisor_id, emisor
      ORDER BY ventas DESC, facturas DESC, emisor ASC
      `,
      [window.fechaInicio, window.fechaFin],
    );

    const items = (rows as VentaPorEmisorRow[]).map((row) => ({
      emisorId: this.toNumber(row.emisorId),
      emisor: row.emisor?.trim() || `Emisor ${this.toNumber(row.emisorId)}`,
      ventas: this.toMoney(row.ventas),
      facturas: this.toNumber(row.facturas),
      clientes: this.toNumber(row.clientes),
    }));

    return {
      window,
      filters: {
        soloTimbradas,
      },
      summary: {
        totalEmisores: items.length,
        totalVentas: this.toMoney(items.reduce((sum, item) => sum + item.ventas, 0)),
        totalFacturas: items.reduce((sum, item) => sum + item.facturas, 0),
        totalClientesAgrupados: items.reduce((sum, item) => sum + item.clientes, 0),
      },
      items,
    };
  }

  private resolveWindow(fechaInicio?: string, fechaFin?: string) {
    const today = this.toLocalDateString(new Date());
    const startOfYear = `${today.slice(0, 4)}-01-01`;
    const window = {
      fechaInicio: (fechaInicio ?? startOfYear).trim(),
      fechaFin: (fechaFin ?? today).trim(),
    };

    if (window.fechaInicio > window.fechaFin) {
      throw new BadRequestException('fechaInicio no puede ser mayor que fechaFin');
    }

    return window;
  }

  private parseBooleanFlag(value?: string) {
    if (value === undefined) {
      return false;
    }

    return value.trim().toLowerCase() === 'true';
  }

  private toLocalDateString(date: Date) {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
  }

  private buildTimbradasFilter(soloTimbradas: boolean) {
    if (!soloTimbradas) {
      return '';
    }

    return `
      AND EXISTS (
        SELECT 1
        FROM CFD cf
        WHERE cf.DOCID = d.DOCID
          AND COALESCE(TRIM(cf.XML), '') <> ''
          AND UPPER(COALESCE(cf.CFDMETODOPAGO, '')) IN ('PPD', 'PUE')
          AND UPPER(COALESCE(cf.ESTADO, '')) = 'S'
      )
    `;
  }

  private buildFacturasBaseQuery(timbradasFilter: string) {
    return `
      SELECT
        d.FECHA AS fecha,
        d.CLIENTEID AS cliente_id,
        COALESCE(d.VENDEDORID, 0) AS emisor_id,
        COALESCE(d.TOTAL, 0) AS total,
        COALESCE(
          NULLIF(TRIM(UPPER(dom_doc.ESTADO)), ''),
          NULLIF(TRIM(UPPER(dom_cli.ESTADO)), '')
        ) AS raw_estado
      FROM DOC d
      LEFT JOIN DOM dom_doc
        ON dom_doc.DOMID = d.DOMDOCID
      LEFT JOIN CLI c
        ON c.CLIENTEID = d.CLIENTEID
      LEFT JOIN DOM dom_cli
        ON dom_cli.DOMID = c.DOMID
      WHERE d.TIPO = 'F'
        AND COALESCE(d.ESTADO, '') <> 'C'
        AND d.FECHA BETWEEN ? AND ?
        ${timbradasFilter}
    `;
  }

  private buildEstadoCaseExpression(rawEstadoExpression: string) {
    return `
      CASE
        WHEN ${rawEstadoExpression} IN ('AGU', 'AGUASCALIENTES') THEN 'Aguascalientes'
        WHEN ${rawEstadoExpression} IN ('BC', 'BCN', 'BAJA CALIFORNIA') THEN 'Baja California'
        WHEN ${rawEstadoExpression} IN ('BCS', 'BAJA CALIFORNIA SUR') THEN 'Baja California Sur'
        WHEN ${rawEstadoExpression} IN ('CAMP', 'CAMPECHE') THEN 'Campeche'
        WHEN ${rawEstadoExpression} IN ('COA', 'COAHUILA', 'COAHUILA DE ZARAGOZA') THEN 'Coahuila'
        WHEN ${rawEstadoExpression} IN ('COL', 'COLIMA') THEN 'Colima'
        WHEN ${rawEstadoExpression} IN ('CHIS', 'CHP', 'CHIAPAS') THEN 'Chiapas'
        WHEN ${rawEstadoExpression} IN ('CHIH', 'CHH', 'CHIHUAHUA') THEN 'Chihuahua'
        WHEN ${rawEstadoExpression} IN ('CDMX', 'CMX', 'DF', 'DIF', 'DISTRITO FEDERAL', 'CIUDAD DE MEXICO', 'CIUDAD DE MEXICO') THEN 'Ciudad de Mexico'
        WHEN ${rawEstadoExpression} IN ('DGO', 'DUR', 'DURANGO') THEN 'Durango'
        WHEN ${rawEstadoExpression} IN ('GTO', 'GUA', 'GUANAJUATO') THEN 'Guanajuato'
        WHEN ${rawEstadoExpression} IN ('GRO', 'GUERRERO') THEN 'Guerrero'
        WHEN ${rawEstadoExpression} IN ('HGO', 'HID', 'HIDALGO') THEN 'Hidalgo'
        WHEN ${rawEstadoExpression} IN ('JAL', 'JALISCO') THEN 'Jalisco'
        WHEN ${rawEstadoExpression} IN ('MEX', 'EDOMEX', 'ESTADO DE MEXICO', 'ESTADO DE MEXICO', 'MEXICO') THEN 'Estado de Mexico'
        WHEN ${rawEstadoExpression} IN ('MICH', 'MIC', 'MICHOACAN', 'MICHOACAN DE OCAMPO') THEN 'Michoacan'
        WHEN ${rawEstadoExpression} IN ('MOR', 'MORELOS') THEN 'Morelos'
        WHEN ${rawEstadoExpression} IN ('NAY', 'NAYARIT') THEN 'Nayarit'
        WHEN ${rawEstadoExpression} IN ('NL', 'NLE', 'NLEON', 'NUEVO LEON') THEN 'Nuevo Leon'
        WHEN ${rawEstadoExpression} IN ('OAX', 'OAXACA') THEN 'Oaxaca'
        WHEN ${rawEstadoExpression} IN ('PUE', 'PUEBLA') THEN 'Puebla'
        WHEN ${rawEstadoExpression} IN ('QRO', 'QUE', 'QUERETARO') THEN 'Queretaro'
        WHEN ${rawEstadoExpression} IN ('QROO', 'QR', 'ROO', 'QUINTANA ROO') THEN 'Quintana Roo'
        WHEN ${rawEstadoExpression} IN ('SLP', 'SAN LUIS POTOSI') THEN 'San Luis Potosi'
        WHEN ${rawEstadoExpression} IN ('SIN', 'SINALOA') THEN 'Sinaloa'
        WHEN ${rawEstadoExpression} IN ('SON', 'SONORA') THEN 'Sonora'
        WHEN ${rawEstadoExpression} IN ('TAB', 'TABASCO') THEN 'Tabasco'
        WHEN ${rawEstadoExpression} IN ('TAMPS', 'TAMS', 'TAM', 'TAMAULIPAS') THEN 'Tamaulipas'
        WHEN ${rawEstadoExpression} IN ('TLA', 'TLAXCALA') THEN 'Tlaxcala'
        WHEN ${rawEstadoExpression} IN ('VER', 'VERACRUZ', 'VERACRUZ DE IGNACIO DE LA LLAVE') THEN 'Veracruz'
        WHEN ${rawEstadoExpression} IN ('YUC', 'YUCATAN') THEN 'Yucatan'
        WHEN ${rawEstadoExpression} IN ('ZAC', 'ZACATECAS') THEN 'Zacatecas'
        WHEN ${rawEstadoExpression} IS NULL OR ${rawEstadoExpression} = '' THEN 'Sin estado'
        ELSE ${rawEstadoExpression}
      END
    `;
  }

  private getMonthName(month: number) {
    const months = [
      '',
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];

    return months[month] ?? '';
  }

  private toNumber(value: string | number | null | undefined) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private toMoney(value: string | number | null | undefined) {
    return Math.round((this.toNumber(value) + Number.EPSILON) * 100) / 100;
  }
}
