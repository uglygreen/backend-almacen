import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AlmacenUser, Surtido } from '../../entities';
import { ConfigAlmacen } from '../../entities/config-almacen.entity';
import { ValidateOrderAlmacenDto } from './dto/validate-order-almacen.dto';

const CC_PREFIXES = [
  'PAM', 'PBM', 'PCM', 'PDM', 'PEM', 'PFM', 'PGM', 'PHM', 'PIM', 'PJM',
  'PKM', 'PLM', 'PMM', 'PNM', 'PÑM', 'POM', 'PPM', 'PQM', 'PRM', 'PSM',
  'PTM', 'PUM', 'PVM', 'PWM', 'PXM', 'PYM', 'PZM',
];

@Injectable()
export class OrdersAlmacenService {
  constructor(
    @InjectDataSource('default') private readonly sistemasDataSource: DataSource,
    @InjectDataSource('legacy_db') private readonly datosbDataSource: DataSource,
    @InjectRepository(AlmacenUser) private readonly almacenUserRepository: Repository<AlmacenUser>,
    @InjectRepository(Surtido) private readonly surtidoRepository: Repository<Surtido>,
    @InjectRepository(ConfigAlmacen) private readonly configRepository: Repository<ConfigAlmacen>,
  ) {}

  async validateOrder(dto: ValidateOrderAlmacenDto) {
    const location = dto.location.toUpperCase() as 'AL' | 'CC';
    const user = await this.almacenUserRepository.findOne({
      where: { id: dto.operatorId },
    });

    if (!user) {
      throw new NotFoundException(`No existe el almacenista ${dto.operatorId}`);
    }

    if (!user.activo) {
      return {
        valid: false,
        code: 'USER_INACTIVE',
        operator: { id: user.id, nombre: user.nombre, active: false },
      };
    }

    const duplicate = await this.surtidoRepository.count({
      where: {
        pedido: dto.folio,
        serie: dto.serie,
        lugar: location,
      },
    });

    if (duplicate > 0) {
      return {
        valid: false,
        code: 'ORDER_ALREADY_CAPTURED',
        operator: { id: user.id, nombre: user.nombre, active: true },
        capture: { alreadyCaptured: true, location },
      };
    }

    const orderRows = await this.datosbDataSource.query(
      `
      SELECT FECHA, ESTADO
      FROM DOC
      WHERE NUMERO = ?
        AND SERIE = ?
        AND TIPO = 'C'
        AND ESTADO != 'C'
      LIMIT 1
      `,
      [dto.folio, dto.serie],
    );

    if (!orderRows.length) {
      return {
        valid: false,
        code: 'ORDER_NOT_FOUND',
        operator: { id: user.id, nombre: user.nombre, active: true },
        order: { serie: dto.serie, folio: dto.folio, exists: false },
      };
    }

    const orderDate = this.normalizeOrderDate(orderRows[0].FECHA);
    const dateWindow = await this.resolveDateWindow();
    const dateStatus = this.validateDateWindow(dto.serie, orderDate, dateWindow.fechaMin, dateWindow.fechaMax);

    if (dateStatus !== 'ok') {
      return {
        valid: false,
        code: 'ORDER_OUT_OF_DATE_RANGE',
        operator: { id: user.id, nombre: user.nombre, active: true },
        order: { serie: dto.serie, folio: dto.folio, exists: true, date: orderDate },
        capture: {
          alreadyCaptured: false,
          dateStatus,
          location,
        },
        config: dateWindow,
      };
    }

    const partidas = await this.countPartidas(dto.serie, dto.folio, location);

    if (partidas <= 0) {
      return {
        valid: false,
        code: 'ORDER_WITHOUT_MATCHING_ITEMS',
        operator: { id: user.id, nombre: user.nombre, active: true },
        order: { serie: dto.serie, folio: dto.folio, exists: true, date: orderDate },
        capture: {
          alreadyCaptured: false,
          partidas,
          location,
          dateStatus: 'ok',
        },
      };
    }

    return {
      valid: true,
      operator: {
        id: user.id,
        name: user.nombre,
        active: true,
      },
      order: {
        serie: dto.serie,
        folio: dto.folio,
        exists: true,
        cancelled: false,
        date: orderDate,
      },
      capture: {
        alreadyCaptured: false,
        partidas,
        location,
        dateStatus: 'ok',
      },
      config: dateWindow,
    };
  }

  private async resolveDateWindow() {
    const config = await this.configRepository.find({ order: { id: 'ASC' }, take: 1 });
    const firstConfig = config[0];
    const today = new Date().toISOString().slice(0, 10);

    return {
      fechaMin: firstConfig?.fechaMin ?? today,
      fechaMax: firstConfig?.fechaMax ?? today,
    };
  }

  private validateDateWindow(serie: string, orderDate: string, fechaMin: string, fechaMax: string) {
    if (serie === '1') {
      return 'ok';
    }

    if (!fechaMin || !fechaMax) {
      return 'sin_config';
    }

    if (orderDate < fechaMin || orderDate > fechaMax) {
      return 'fuera_rango';
    }

    return 'ok';
  }

  private normalizeOrderDate(value: unknown) {
    if (value instanceof Date) {
      return this.formatDate(value);
    }

    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return value.slice(0, 10);
      }

      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return this.formatDate(parsed);
      }
    }

    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) {
      return this.formatDate(parsed);
    }

    return String(value);
  }

  private formatDate(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async countPartidas(serie: string, folio: number, location: 'AL' | 'CC') {
    const operator = location === 'CC' ? 'OR' : 'AND';
    const comparator = location === 'CC' ? 'LIKE' : 'NOT LIKE';
    const filters = CC_PREFIXES.map(() => `UPPER(DDOC1.UBICACION) ${comparator} ?`).join(` ${operator} `);
    const sql = `
      SELECT COUNT(DDOC1.UBICACION) AS partidas
      FROM DOC
      LEFT JOIN DES AS DDOC ON DOC.DOCID = DDOC.DESDOCID
      LEFT JOIN ALM AS DDOC1 ON DDOC.DESARTID = DDOC1.ARTICULOID AND DDOC1.ALMACEN = 1
      WHERE DOC.NUMERO = ?
        AND DOC.SERIE = ?
        AND DDOC.DESTIPO = 'C'
        AND (${filters})
        AND DDOC.DESCANTIDAD > 0
    `;

    const params = [folio, serie, ...CC_PREFIXES.map((prefix) => `${prefix}%`)];
    const rows = await this.datosbDataSource.query(sql, params);
    return Number(rows?.[0]?.partidas ?? 0);
  }
}
