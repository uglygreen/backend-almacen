import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Cliente, CompagLegacy } from '../../entities';
import { ListCuentasPorCobrarComplementosDto } from './dto/list-cuentas-por-cobrar-complementos.dto';
import { SearchCuentasPorCobrarClientesDto } from './dto/search-cuentas-por-cobrar-clientes.dto';

@Injectable()
export class CuentasPorCobrarBackofficeService {
  constructor(
    @InjectRepository(Cliente, 'legacy_db')
    private readonly clienteRepository: Repository<Cliente>,
    @InjectRepository(CompagLegacy, 'legacy_db')
    private readonly compagRepository: Repository<CompagLegacy>,
  ) {}

  async searchClientes(query: SearchCuentasPorCobrarClientesDto) {
    const search = this.normalizeText(query.search);
    const nombre = this.normalizeText(query.nombre);
    const numero = this.normalizeText(query.numero);
    const limit = query.limit ?? 10;

    if (!search && !nombre && !numero) {
      throw new BadRequestException('Debes indicar al menos un criterio de busqueda por nombre y/o numero');
    }

    const clientes = await this.clienteRepository
      .createQueryBuilder('cliente')
      .where(
        new Brackets((qb) => {
          if (search) {
            qb.where('cliente.nombre LIKE :search', { search: `%${search}%` })
              .orWhere('cliente.numero LIKE :search', { search: `%${search}%` });
            return;
          }

          qb.where('1 = 1');
        }),
      )
      .andWhere(nombre ? 'cliente.nombre LIKE :nombre' : '1 = 1', nombre ? { nombre: `%${nombre}%` } : {})
      .andWhere(numero ? 'cliente.numero LIKE :numero' : '1 = 1', numero ? { numero: `%${numero}%` } : {})
      .orderBy('cliente.nombre', 'ASC')
      .addOrderBy('cliente.numero', 'ASC')
      .take(limit)
      .getMany();

    return {
      filters: {
        search,
        nombre,
        numero,
        limit,
      },
      total: clientes.length,
      items: clientes.map((cliente) => ({
        clienteId: cliente.clienteId,
        numero: this.cleanNullableString(cliente.numero),
        nombre: this.cleanNullableString(cliente.nombre),
        activo: this.cleanNullableString(cliente.activo),
      })),
    };
  }

  async listComplementos(query: ListCuentasPorCobrarComplementosDto) {
    const { from, to } = this.resolveDateRange(query.from, query.to);
    const cliente = await this.resolveCliente(query.clienteId, query.numeroCliente);

    const complementos = await this.compagRepository
      .createQueryBuilder('compag')
      .leftJoinAndSelect('compag.cliente', 'cliente')
      .leftJoinAndSelect('compag.cfd', 'cfd')
      .leftJoinAndSelect('compag.pagos', 'pago')
      .leftJoinAndSelect('pago.aplicacionesDocumento', 'pagDoc')
      .leftJoinAndSelect('pagDoc.doc', 'doc')
      .where('compag.cpClienteId = :clienteId', { clienteId: cliente.clienteId })
      .andWhere('compag.cpFecha >= :from', { from: this.formatDate(from) })
      .andWhere('compag.cpFecha <= :to', { to: this.formatDate(to) })
      .orderBy('compag.cpFecha', 'DESC')
      .addOrderBy('compag.cpId', 'DESC')
      .getMany();

    const items = complementos.map((complemento) => {
      const facturasMap = new Map<number, {
        docId: number;
        folio: string;
        fecha: string | null;
        vencimiento: string | null;
        total: number;
        totalPagado: number;
        saldoPendiente: number;
        estadoCfd: string | null;
        montoAplicado: number;
      }>();

      const pagos = (complemento.pagos ?? []).map((pago) => {
        for (const aplicacion of pago.aplicacionesDocumento ?? []) {
          if (!aplicacion.doc?.docId) {
            continue;
          }

          const current = facturasMap.get(aplicacion.doc.docId);
          const montoAplicado = this.toMoney(aplicacion.pagado);
          if (current) {
            current.montoAplicado = this.toMoney(current.montoAplicado + montoAplicado);
            continue;
          }

          facturasMap.set(aplicacion.doc.docId, {
            docId: aplicacion.doc.docId,
            folio: this.buildFolio(aplicacion.doc.serie, aplicacion.doc.numero),
            fecha: this.formatNullableDate(aplicacion.doc.fecha),
            vencimiento: this.formatNullableDate(aplicacion.doc.vence),
            total: this.toMoney(aplicacion.doc.total),
            totalPagado: this.toMoney(aplicacion.doc.totalPagado),
            saldoPendiente: this.toMoney(this.toNumber(aplicacion.doc.total) - this.toNumber(aplicacion.doc.totalPagado)),
            estadoCfd: this.cleanNullableString(aplicacion.doc.estadoCfd),
            montoAplicado,
          });
        }

        return {
          pagoId: pago.pgId,
          fecha: this.formatNullableDateTime(pago.pgFecha),
          fechaAplicada: this.formatNullableDate(pago.pgFechaAplicada),
          formaPago: this.cleanNullableString(pago.pgFormaPago),
          referencia: this.cleanNullableString(pago.pgReferencia),
          recibo: this.toNullableNumber(pago.pgRecibo),
          importe: this.toMoney(pago.pgImporte),
        };
      });

      const facturas = Array.from(facturasMap.values()).sort((a, b) => a.folio.localeCompare(b.folio));
      const montoAplicadoTotal = this.toMoney(
        facturas.reduce((total, factura) => total + factura.montoAplicado, 0),
      );

      return {
        compagId: complemento.cpId,
        clienteId: cliente.clienteId,
        clienteNumero: this.cleanNullableString(cliente.numero),
        clienteNombre: this.cleanNullableString(cliente.nombre),
        serie: this.cleanNullableString(complemento.cpSerie),
        folio: this.buildFolio(complemento.cpSerie, complemento.cpFolio),
        fecha: this.formatNullableDate(complemento.cpFecha),
        hora: this.cleanNullableString(complemento.cpHora),
        montoTotal: this.toMoney(complemento.cpMontoTotal),
        montoAplicadoTotal,
        estado: this.cleanNullableString(complemento.cpEstado),
        uuid: this.cleanNullableString(complemento.cfd?.uuid),
        xmlDisponible: this.hasTimbradoXml(complemento.cfd?.xml),
        totalPagosRegistrados: pagos.length,
        totalFacturasRelacionadas: facturas.length,
        pagos,
        facturas,
      };
    });

    return {
      filters: {
        from: this.formatDate(from),
        to: this.formatDate(to),
        clienteId: cliente.clienteId,
        numeroCliente: this.cleanNullableString(cliente.numero),
        nombreCliente: this.cleanNullableString(cliente.nombre),
      },
      summary: {
        totalComplementos: items.length,
        totalMontoComplementos: this.toMoney(items.reduce((total, item) => total + item.montoTotal, 0)),
        totalMontoAplicado: this.toMoney(items.reduce((total, item) => total + item.montoAplicadoTotal, 0)),
        totalFacturasRelacionadas: items.reduce((total, item) => total + item.totalFacturasRelacionadas, 0),
      },
      items,
    };
  }

  private async resolveCliente(clienteId?: number, numeroCliente?: string) {
    if (!clienteId && !this.normalizeText(numeroCliente)) {
      throw new BadRequestException('Debes indicar clienteId o numeroCliente para consultar complementos');
    }

    const qb = this.clienteRepository.createQueryBuilder('cliente');
    if (clienteId) {
      qb.where('cliente.clienteId = :clienteId', { clienteId });
    }

    const numero = this.normalizeText(numeroCliente);
    if (numero) {
      if (clienteId) {
        qb.andWhere('cliente.numero = :numero', { numero });
      } else {
        qb.where('cliente.numero = :numero', { numero });
      }
    }

    const cliente = await qb.getOne();
    if (!cliente) {
      throw new NotFoundException('No se encontró el cliente indicado');
    }

    return cliente;
  }

  private resolveDateRange(fromInput: string, toInput: string) {
    const from = this.parseDateOnly(fromInput);
    const to = this.parseDateOnly(toInput);

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('La fecha inicial no puede ser mayor que la fecha final');
    }

    return { from, to };
  }

  private parseDateOnly(value: string) {
    const trimmed = `${value ?? ''}`.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new BadRequestException(`La fecha "${value}" debe tener formato YYYY-MM-DD`);
    }

    const parsed = new Date(`${trimmed}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`La fecha "${value}" no es válida`);
    }

    return parsed;
  }

  private formatDate(value: Date) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatNullableDate(value?: Date | null) {
    if (!value) {
      return null;
    }

    return this.formatDate(new Date(value));
  }

  private formatNullableDateTime(value?: Date | null) {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    const datePart = this.formatDate(date);
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    const seconds = `${date.getSeconds()}`.padStart(2, '0');
    return `${datePart} ${hours}:${minutes}:${seconds}`;
  }

  private buildFolio(serie?: string | null, folio?: number | string | null) {
    const serieValue = this.cleanNullableString(serie);
    const folioValue = folio === null || folio === undefined ? null : `${folio}`.trim();
    if (serieValue && folioValue) {
      return `${serieValue}-${folioValue}`;
    }

    return serieValue ?? folioValue ?? 'N/D';
  }

  private normalizeText(value?: string | null) {
    const normalized = `${value ?? ''}`.trim();
    return normalized.length ? normalized : null;
  }

  private cleanNullableString(value?: string | null) {
    const normalized = this.normalizeText(value);
    return normalized ?? null;
  }

  private toNumber(value?: number | string | null) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private toNullableNumber(value?: number | string | null) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private toMoney(value?: number | string | null) {
    return Math.round(this.toNumber(value) * 100) / 100;
  }

  private hasTimbradoXml(xml?: string | null) {
    if (!xml) {
      return false;
    }

    return !/<(?:[\w-]+:)?EmitirTimbrar\b/i.test(xml);
  }
}
