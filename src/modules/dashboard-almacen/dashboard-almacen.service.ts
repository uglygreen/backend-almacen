import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const TIMESLOTS = [
  { key: '07-10', from: '07:00:00', to: '10:59:59' },
  { key: '11-11', from: '11:00:00', to: '11:59:59' },
  { key: '12-12', from: '12:00:00', to: '12:59:59' },
  { key: '13-14', from: '13:00:00', to: '14:59:59' },
  { key: '15-15', from: '15:00:00', to: '15:59:59' },
  { key: '16-16', from: '16:00:00', to: '16:59:59' },
  { key: '17-17', from: '17:00:00', to: '17:59:59' },
  { key: '18-18', from: '18:00:00', to: '18:59:59' },
  { key: '19-19', from: '19:00:00', to: '19:59:59' },
  { key: '20-23', from: '20:00:00', to: '23:59:59' },
];

@Injectable()
export class DashboardAlmacenService {
  constructor(
    @InjectDataSource('default') private readonly sistemasDataSource: DataSource,
    @InjectDataSource('legacy_db') private readonly datosbDataSource: DataSource,
  ) {}

  async getSummary(date?: string) {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    const activeUsers = await this.sistemasDataSource.query(
      `
      SELECT
        u.id_almacenista AS operatorId,
        u.nombre,
        u.area,
        u.seccion
      FROM almacen_user u
      WHERE u.activo = 1
        AND (
          LOWER(TRIM(COALESCE(u.area, ''))) LIKE '%almacen%'
          OR EXISTS (
            SELECT 1
            FROM surtido s
            WHERE s.id_almacenista = u.id_almacenista
              AND s.fecha = ?
          )
        )
      ORDER BY nombre ASC
      `,
      [targetDate],
    );

    const surtidos = await this.sistemasDataSource.query(
      `
      SELECT id_surtido, id_almacenista, partidas, pedido, hora, lugar, fecha_aplicada
      FROM surtido
      WHERE fecha = ?
      ORDER BY id_almacenista ASC, id_surtido ASC
      `,
      [targetDate],
    );

    const backlog = await this.getBacklog(targetDate);
    const operators = activeUsers
      .map((user: any) => this.buildOperatorSummary(user, surtidos))
      .sort((a: any, b: any) => {
        const partidasDiff = Number(b.total?.partidas ?? 0) - Number(a.total?.partidas ?? 0);
        if (partidasDiff !== 0) {
          return partidasDiff;
        }

        const pedidosDiff = Number(b.total?.pedidos ?? 0) - Number(a.total?.pedidos ?? 0);
        if (pedidosDiff !== 0) {
          return pedidosDiff;
        }

        return String(a.name ?? '').localeCompare(String(b.name ?? ''));
      });
    const topPerformer = this.getTopPerformer(operators);

    return {
      serverTime: new Date().toISOString(),
      date: targetDate,
      backlog,
      topPerformer,
      timeslots: TIMESLOTS,
      operators,
    };
  }

  async getOperators(date?: string) {
    const summary = await this.getSummary(date);
    return summary.operators;
  }

  async getOperatorTimeslots(id: number, date?: string) {
    const summary = await this.getSummary(date);
    const operator = summary.operators.find((item: any) => item.operatorId === id);

    if (!operator) {
      throw new NotFoundException(`No existe el almacenista ${id}`);
    }

    return {
      operatorId: operator.operatorId,
      name: operator.name,
      total: operator.total,
      timeslots: operator.timeslots,
    };
  }

  async getOperatorLast(id: number, date?: string) {
    const summary = await this.getSummary(date);
    const operator = summary.operators.find((item: any) => item.operatorId === id);

    if (!operator) {
      throw new NotFoundException(`No existe el almacenista ${id}`);
    }

    return operator.last;
  }

  async getWeeklyReport(id: number) {
    const window = this.resolveWeeklyWindow();
    const rows = await this.sistemasDataSource.query(
      `
      SELECT
        fecha,
        COUNT(pedido) AS pedidos,
        IFNULL(ROUND(SUM(partidas), 0), 0) AS partidas,
        IFNULL(SUM(CASE WHEN UPPER(lugar) = 'AL' THEN partidas ELSE 0 END), 0) AS partidasAl,
        IFNULL(SUM(CASE WHEN UPPER(lugar) = 'CC' THEN partidas ELSE 0 END), 0) AS partidasCc
      FROM surtido
      WHERE id_almacenista = ?
        AND fecha BETWEEN ? AND ?
      GROUP BY fecha
      ORDER BY fecha ASC
      `,
      [id, window.startDate, window.endDate],
    );

    const daily = rows.map((row: any) => ({
      fecha: row.fecha,
      pedidos: Number(row.pedidos ?? 0),
      partidas: Number(row.partidas ?? 0),
      partidasAl: Number(row.partidasAl ?? 0),
      partidasCc: Number(row.partidasCc ?? 0),
      comision: this.calculateCommission(Number(row.partidasAl ?? 0), Number(row.partidasCc ?? 0)),
    }));

    const total = daily.reduce(
      (acc: any, row: any) => {
        acc.pedidos += row.pedidos;
        acc.partidas += row.partidas;
        acc.partidasAl += row.partidasAl;
        acc.partidasCc += row.partidasCc;
        acc.comision += row.comision;
        return acc;
      },
      { pedidos: 0, partidas: 0, partidasAl: 0, partidasCc: 0, comision: 0 },
    );

    return {
      operatorId: id,
      week: window,
      daily,
      total,
    };
  }

  async getOrdersDetail(id: number, date: string, from: string, to: string) {
    return this.sistemasDataSource.query(
      `
      SELECT id_surtido, id_almacenista AS operatorId, pedido, partidas, hora, lugar, fecha
      FROM surtido
      WHERE id_almacenista = ?
        AND fecha = ?
        AND hora BETWEEN ? AND ?
      ORDER BY hora ASC, id_surtido ASC
      `,
      [id, date, from, to],
    );
  }

  private buildOperatorSummary(user: any, surtidos: any[]) {
    const items = surtidos.filter((item) => Number(item.id_almacenista) === Number(user.operatorId));
    const lastItem = items.length ? items[items.length - 1] : null;

    return {
      operatorId: Number(user.operatorId),
      name: user.nombre,
      area: user.area,
      section: user.seccion,
      total: {
        partidas: items.reduce((acc, item) => acc + Number(item.partidas ?? 0), 0),
        pedidos: items.length,
      },
      last: lastItem
        ? {
            pedido: Number(lastItem.pedido),
            partidas: Number(lastItem.partidas),
            lugar: String(lastItem.lugar).toUpperCase(),
            hora: lastItem.hora,
            minutesSince: this.getMinutesSince(lastItem.fecha_aplicada),
          }
        : {
            pedido: null,
            partidas: 0,
            lugar: null,
            hora: null,
            minutesSince: null,
          },
      timeslots: TIMESLOTS.map((slot) => {
        const slotItems = items.filter((item) => item.hora >= slot.from && item.hora <= slot.to);
        const partidas = slotItems.reduce((acc, item) => acc + Number(item.partidas ?? 0), 0);
        return {
          ...slot,
          partidas,
          pedidos: slotItems.length,
          level: this.resolveLevel(partidas),
        };
      }),
    };
  }

  private resolveLevel(partidas: number) {
    if (partidas < 70) return 'danger';
    if (partidas <= 90) return 'warning';
    return 'success';
  }

  private getMinutesSince(value: string | Date | null) {
    if (!value) return null;
    const now = Date.now();
    const then = new Date(value).getTime();
    return Math.max(Math.floor((now - then) / 60000), 0);
  }

  private async getBacklog(targetDate: string) {
    const [porBajar] = await this.datosbDataSource.query(
      `
      SELECT COUNT(d.docid) AS bajar
      FROM doc d
      WHERE d.fecha = ?
        AND d.tipo IN ('C')
        AND d.serie NOT LIKE 'CH'
        AND (d.subtotal2 > 0 OR d.subtotal1 > 0)
        AND d.FECCAN = 0
        AND d.estado = 'P'
      `,
      [targetDate],
    );

    const [porSurtir] = await this.datosbDataSource.query(
      `
      SELECT COUNT(d.docid) AS surtir
      FROM doc d
      WHERE d.fecha = ?
        AND d.tipo = 'C'
        AND d.estado = 'A'
        AND d.serie NOT LIKE 'CH'
        AND d.subtotal2 > 0
        AND d.FECCAN = 0
      `,
      [targetDate],
    );

    return {
      porBajar: Number(porBajar?.bajar ?? 0),
      porSurtir: Number(porSurtir?.surtir ?? 0),
    };
  }

  private getTopPerformer(operators: any[]) {
    const slot = this.resolveReferenceSlot();
    const ranking = operators
      .map((operator) => {
        const match = operator.timeslots.find((item: any) => item.key === slot.key);
        return {
          operatorId: operator.operatorId,
          name: operator.name,
          partidas: match?.partidas ?? 0,
          window: { from: slot.from, to: slot.to },
        };
      })
      .sort((a, b) => b.partidas - a.partidas);

    return ranking[0] ?? null;
  }

  private resolveReferenceSlot() {
    const hour = new Date().getHours();
    const currentHour = `${String(hour).padStart(2, '0')}:00:00`;
    return TIMESLOTS.find((slot) => currentHour >= slot.from && currentHour <= slot.to) ?? TIMESLOTS[0];
  }

  private resolveWeeklyWindow() {
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

  private calculateCommission(partidasAl: number, partidasCc: number) {
    let tarifaAl = 0;
    if (partidasAl >= 700) tarifaAl = 0.3;
    else if (partidasAl >= 600) tarifaAl = 0.25;
    else if (partidasAl >= 500) tarifaAl = 0.2;
    else if (partidasAl >= 1) tarifaAl = 0.1;

    const comisionAl = partidasAl * tarifaAl;
    const comisionCc = partidasCc >= 1 ? partidasCc * 0.22 : 0;
    return Number((comisionAl + comisionCc).toFixed(2));
  }
}
