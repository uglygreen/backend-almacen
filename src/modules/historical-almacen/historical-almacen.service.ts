import { BadRequestException, Injectable } from '@nestjs/common';
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
export class HistoricalAlmacenService {
  constructor(
    @InjectDataSource('default')
    private readonly sistemasDataSource: DataSource,
  ) {}

  async getSummary(fechaInicio: string, fechaFin: string) {
    if (fechaInicio > fechaFin) {
      throw new BadRequestException('fechaInicio no puede ser mayor que fechaFin');
    }

    const activeUsers = await this.sistemasDataSource.query(
      `
      SELECT id_almacenista AS operatorId, nombre, area, seccion
      FROM almacen_user
      WHERE activo = 1
      ORDER BY nombre ASC
      `,
    );

    const surtidos = await this.sistemasDataSource.query(
      `
      SELECT id_surtido, id_almacenista, partidas, pedido, hora, lugar, fecha
      FROM surtido
      WHERE fecha BETWEEN ? AND ?
      ORDER BY id_almacenista ASC, fecha ASC, hora ASC, id_surtido ASC
      `,
      [fechaInicio, fechaFin],
    );

    const operators = activeUsers.map((user: any) => this.buildOperatorSummary(user, surtidos));
    const totals = this.buildGlobalTotals(operators);

    return {
      range: { fechaInicio, fechaFin },
      timeslots: TIMESLOTS,
      operators,
      totals,
    };
  }

  private buildOperatorSummary(user: any, surtidos: any[]) {
    const items = surtidos.filter((item) => Number(item.id_almacenista) === Number(user.operatorId));
    const totalPartidas = items.reduce((acc, item) => acc + Number(item.partidas ?? 0), 0);
    const totalPedidos = items.length;

    return {
      operatorId: Number(user.operatorId),
      name: user.nombre,
      area: user.area,
      section: user.seccion,
      total: {
        pedidos: totalPedidos,
        partidas: totalPartidas,
      },
      timeslots: TIMESLOTS.map((slot) => {
        const slotItems = items.filter((item) => item.hora >= slot.from && item.hora <= slot.to);
        return {
          ...slot,
          pedidos: slotItems.length,
          partidas: slotItems.reduce((acc, item) => acc + Number(item.partidas ?? 0), 0),
        };
      }),
    };
  }

  private buildGlobalTotals(operators: Array<any>) {
    const timeslots = TIMESLOTS.map((slot) => {
      const aggregate = operators.reduce(
        (acc, operator) => {
          const match = operator.timeslots.find((item: any) => item.key === slot.key);
          acc.pedidos += Number(match?.pedidos ?? 0);
          acc.partidas += Number(match?.partidas ?? 0);
          return acc;
        },
        { key: slot.key, from: slot.from, to: slot.to, pedidos: 0, partidas: 0 },
      );

      return aggregate;
    });

    return {
      pedidos: operators.reduce((acc, operator) => acc + Number(operator.total.pedidos ?? 0), 0),
      partidas: operators.reduce((acc, operator) => acc + Number(operator.total.partidas ?? 0), 0),
      timeslots,
    };
  }
}
