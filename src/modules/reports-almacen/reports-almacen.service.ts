import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DashboardAlmacenService } from '../dashboard-almacen/dashboard-almacen.service';

@Injectable()
export class ReportsAlmacenService {
  constructor(
    @InjectDataSource('default') private readonly sistemasDataSource: DataSource,
    private readonly dashboardAlmacenService: DashboardAlmacenService,
  ) {}

  async getTopPerformers(
    range: 'today' | 'current-week' = 'current-week',
    startDate?: string,
    endDate?: string,
  ) {
    const window = this.resolveRange(range, startDate, endDate);
    const rows = await this.sistemasDataSource.query(
      `
      SELECT
        u.id_almacenista AS operatorId,
        u.nombre,
        u.area,
        u.seccion,
        COUNT(s.pedido) AS pedidos,
        IFNULL(ROUND(SUM(s.partidas), 0), 0) AS partidas,
        IFNULL(SUM(CASE WHEN UPPER(s.lugar) = 'AL' THEN s.partidas ELSE 0 END), 0) AS partidasAl,
        IFNULL(SUM(CASE WHEN UPPER(s.lugar) = 'CC' THEN s.partidas ELSE 0 END), 0) AS partidasCc
      FROM almacen_user u
      LEFT JOIN surtido s
        ON s.id_almacenista = u.id_almacenista
        AND s.fecha BETWEEN ? AND ?
      WHERE u.activo = 1
      GROUP BY u.id_almacenista, u.nombre, u.area, u.seccion
      ORDER BY partidas DESC, pedidos DESC, u.nombre ASC
      `,
      [window.startDate, window.endDate],
    );

    return {
      range,
      window,
      items: rows.map((row: any) => ({
        operatorId: Number(row.operatorId),
        name: row.nombre,
        area: row.area,
        section: row.seccion,
        pedidos: Number(row.pedidos ?? 0),
        partidas: Number(row.partidas ?? 0),
        partidasAl: Number(row.partidasAl ?? 0),
        partidasCc: Number(row.partidasCc ?? 0),
        comision: this.calculateCommission(
          Number(row.partidasAl ?? 0),
          Number(row.partidasCc ?? 0),
        ),
      })),
    };
  }

  async getWarehouseHourlyReport(
    range: 'today' | 'current-week' = 'current-week',
    startDate?: string,
    endDate?: string,
  ) {
    const window = this.resolveRange(range, startDate, endDate);
    const rows = await this.sistemasDataSource.query(
      `
      SELECT
        s.fecha,
        DATE_FORMAT(s.hora, '%H:00:00') AS hora,
        COUNT(DISTINCT CONCAT(COALESCE(s.serie, ''), '-', s.pedido)) AS pedidos,
        COUNT(*) AS registros,
        IFNULL(ROUND(SUM(s.partidas), 0), 0) AS partidas
      FROM surtido s
      WHERE s.fecha BETWEEN ? AND ?
        AND UPPER(TRIM(COALESCE(s.lugar, ''))) = 'AL'
      GROUP BY s.fecha, HOUR(s.hora)
      ORDER BY s.fecha ASC, hora ASC
      `,
      [window.startDate, window.endDate],
    );

    const items = rows.map((row: any) => ({
      fecha: row.fecha,
      hora: row.hora,
      pedidos: Number(row.pedidos ?? 0),
      registros: Number(row.registros ?? 0),
      partidas: Number(row.partidas ?? 0),
    }));

    const summary = items.reduce(
      (acc, item) => {
        acc.totalPedidos += item.pedidos;
        acc.totalRegistros += item.registros;
        acc.totalPartidas += item.partidas;
        return acc;
      },
      { totalPedidos: 0, totalRegistros: 0, totalPartidas: 0 },
    );

    return {
      range,
      location: 'AL',
      window,
      summary: {
        ...summary,
        totalHorasConActividad: items.length,
      },
      items,
    };
  }

  async getUserAuditReport(
    range: 'today' | 'current-week' = 'current-week',
    startDate?: string,
    endDate?: string,
    userIds?: string,
  ) {
    const window = this.resolveRange(range, startDate, endDate);
    const operatorIds = this.parseUserIds(userIds);
    const params: Array<string | number> = [window.startDate, window.endDate];
    let usersFilter = '';

    if (operatorIds.length) {
      usersFilter = ` AND s.id_almacenista IN (${operatorIds.map(() => '?').join(', ')})`;
      params.push(...operatorIds);
    }

    const rows = await this.sistemasDataSource.query(
      `
      SELECT
        u.id_almacenista AS operatorId,
        u.nombre,
        DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha,
        DATE_FORMAT(s.hora, '%H:%i:%s') AS hora,
        s.pedido,
        IFNULL(s.partidas, 0) AS partidas,
        UPPER(TRIM(COALESCE(s.lugar, ''))) AS lugar,
        s.serie
      FROM surtido s
      INNER JOIN almacen_user u
        ON u.id_almacenista = s.id_almacenista
      WHERE s.fecha BETWEEN ? AND ?
      ${usersFilter}
      ORDER BY u.nombre ASC, s.fecha ASC, s.hora ASC, s.id_surtido ASC
      `,
      params,
    );

    const items = rows.map((row: any) => ({
      operatorId: Number(row.operatorId),
      almacenista: row.nombre,
      fecha: row.fecha,
      hora: row.hora,
      pedido: Number(row.pedido ?? 0),
      partidas: Number(row.partidas ?? 0),
      lugar: row.lugar,
      serie: row.serie,
    }));

    const uniquePedidos = new Set(items.map((item: any) => `${item.serie ?? ''}-${item.pedido}`));
    const uniqueUsers = new Set(items.map((item: any) => item.operatorId));

    return {
      range,
      window,
      filters: {
        userIds: operatorIds,
      },
      summary: {
        totalRegistros: items.length,
        totalPedidos: uniquePedidos.size,
        totalPartidas: items.reduce((acc: number, item: any) => acc + Number(item.partidas ?? 0), 0),
        totalUsuarios: uniqueUsers.size,
      },
      items,
    };
  }

  getWeeklyReport(operatorId: number) {
    return this.dashboardAlmacenService.getWeeklyReport(operatorId);
  }

  getOrdersDetail(operatorId: number, date: string, from: string, to: string) {
    return this.dashboardAlmacenService.getOrdersDetail(operatorId, date, from, to);
  }

  private resolveRange(range: 'today' | 'current-week', startDate?: string, endDate?: string) {
    if (startDate && endDate) {
      return { startDate, endDate };
    }

    if (range === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      return { startDate: today, endDate: today };
    }

    const current = new Date();
    const start = new Date(current);
    const day = current.getDay();
    const diffToFriday = day >= 5 ? day - 5 : day + 2;
    start.setDate(current.getDate() - diffToFriday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  private parseUserIds(userIds?: string) {
    if (!userIds) {
      return [];
    }

    return userIds
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  private calculateCommission(partidasAl: number, partidasCc: number) {
    let tarifaAl = 0;

    if (partidasAl >= 700) {
      tarifaAl = 0.3;
    } else if (partidasAl >= 600) {
      tarifaAl = 0.25;
    } else if (partidasAl >= 500) {
      tarifaAl = 0.2;
    } else if (partidasAl >= 1) {
      tarifaAl = 0.1;
    }

    const comisionAl = partidasAl * tarifaAl;
    const comisionCc = partidasCc >= 1 ? partidasCc * 0.22 : 0;
    return Number((comisionAl + comisionCc).toFixed(2));
  }
}
