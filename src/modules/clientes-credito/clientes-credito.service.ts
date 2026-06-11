import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente, ClienteCreditoExcepcion, DocLegacy } from '../../entities';
import { CreateClienteCreditoExcepcionDto } from './dto/create-cliente-credito-excepcion.dto';
import { ListClienteCreditoExcepcionesDto } from './dto/list-cliente-credito-excepciones.dto';
import { UpdateClienteCreditoExcepcionDto } from './dto/update-cliente-credito-excepcion.dto';

type EstadoCreditoResultado = {
  clave: string;
  descripcion: string;
  puede_generar_pedido: boolean;
  puede_generar_cotizacion: boolean;
  mensaje: string;
  reglaTipo: string;
  reglaDetalle: string;
};

type FacturaVencidaResumen = {
  folio: string;
  dias_atraso: number;
  monto: number;
};

@Injectable()
export class ClientesCreditoService {
  private readonly logger = new Logger(ClientesCreditoService.name);

  constructor(
    @InjectRepository(Cliente, 'legacy_db')
    private readonly clientesRepository: Repository<Cliente>,
    @InjectRepository(DocLegacy, 'legacy_db')
    private readonly docRepository: Repository<DocLegacy>,
    @InjectRepository(ClienteCreditoExcepcion)
    private readonly excepcionesRepository: Repository<ClienteCreditoExcepcion>,
  ) {}

  async createExcepcion(dto: CreateClienteCreditoExcepcionDto) {
    const numeroCliente = this.normalizeNumeroCliente(dto.numeroCliente);
    const cliente = await this.findClienteByNumero(numeroCliente);
    const { start, end } = this.getTodayRange();

    const existente = await this.excepcionesRepository
      .createQueryBuilder('excepcion')
      .where('excepcion.numeroCliente = :numeroCliente', { numeroCliente })
      .andWhere('excepcion.createdAt >= :start', { start })
      .andWhere('excepcion.createdAt <= :end', { end })
      .orderBy('excepcion.id', 'DESC')
      .getOne();

    if (existente) {
      if (numeroCliente !== existente.numeroCliente) {
        existente.numeroCliente = numeroCliente;
        const updated = await this.excepcionesRepository.save(existente);
        return this.mapExcepcion(updated);
      }

      return this.mapExcepcion(existente);
    }

    const entity = this.excepcionesRepository.create({
      clienteId: cliente.clienteId,
      numeroCliente,
    });

    const saved = await this.excepcionesRepository.save(entity);
    return this.mapExcepcion(saved);
  }

  async listExcepciones(query: ListClienteCreditoExcepcionesDto) {
    const { start, end } = this.getTodayRange();
    const qb = this.excepcionesRepository
      .createQueryBuilder('excepcion')
      .where('excepcion.createdAt >= :start', { start })
      .andWhere('excepcion.createdAt <= :end', { end })
      .orderBy('excepcion.updatedAt', 'DESC')
      .take(query.limit ?? 50);

    if (query.clienteId) {
      qb.andWhere('excepcion.clienteId = :clienteId', { clienteId: query.clienteId });
    }

    if (query.numeroCliente?.trim()) {
      qb.andWhere('excepcion.numeroCliente = :numeroCliente', { numeroCliente: query.numeroCliente.trim() });
    }

    const rows = await qb.getMany();
    return rows.map((row) => this.mapExcepcion(row));
  }

  async getExcepcion(id: number) {
    const excepcion = await this.excepcionesRepository.findOne({ where: { id } });
    if (!excepcion) {
      throw new NotFoundException(`No se encontró la excepción ${id}`);
    }

    return this.mapExcepcion(excepcion);
  }

  async updateExcepcion(id: number, dto: UpdateClienteCreditoExcepcionDto) {
    const excepcion = await this.excepcionesRepository.findOne({ where: { id } });
    if (!excepcion) {
      throw new NotFoundException(`No se encontró la excepción ${id}`);
    }

    if (dto.numeroCliente !== undefined) {
      const numeroCliente = this.normalizeNumeroCliente(dto.numeroCliente);
      const cliente = await this.findClienteByNumero(numeroCliente);
      excepcion.numeroCliente = numeroCliente;
      excepcion.clienteId = cliente.clienteId;
    }

    const saved = await this.excepcionesRepository.save(excepcion);
    return this.mapExcepcion(saved);
  }

  async deleteExcepcion(id: number) {
    const excepcion = await this.excepcionesRepository.findOne({ where: { id } });
    if (!excepcion) {
      throw new NotFoundException(`No se encontró la excepción ${id}`);
    }

    await this.excepcionesRepository.delete(id);
    return { deleted: true, id };
  }

  @Cron('0 0 23 * * *')
  async cleanupExpiredExcepciones() {
    const result = await this.excepcionesRepository
      .createQueryBuilder()
      .delete()
      .from(ClienteCreditoExcepcion)
      .execute();

    this.logger.log(`Limpieza diaria de excepciones ejecutada a las 23:00. Registros eliminados: ${result.affected ?? 0}`);
  }

  async getResumenCliente(clienteId: number) {
    const cliente = await this.clientesRepository.findOne({
      where: { clienteId },
      relations: ['domicilioPrincipal', 'domicilios'],
    });

    if (!cliente) {
      throw new NotFoundException(`No se encontró el cliente ${clienteId}`);
    }

    const facturasAbiertas = await this.docRepository
      .createQueryBuilder('doc')
      .where('doc.clienteId = :clienteId', { clienteId })
      .andWhere('doc.tipo = :tipo', { tipo: 'F' })
      .andWhere('doc.estado = :estado', { estado: 'I' })
      .andWhere('(COALESCE(doc.total, 0) - COALESCE(doc.totalPagado, 0)) > 0')
      .orderBy('doc.vence', 'ASC')
      .getMany();

    const hoy = this.startOfToday();
    const saldoActual = this.toMoney(cliente.saldo);
    const lineaCredito = this.toMoney(cliente.limite);
    const creditoDisponible = this.toMoney(lineaCredito - saldoActual);
    const activo = this.isClienteActivo(cliente.activo);

    const facturasVencidas: FacturaVencidaResumen[] = facturasAbiertas
      .map((factura) => {
        const montoPendiente = this.toMoney(this.toNumber(factura.total) - this.toNumber(factura.totalPagado));
        const fechaVencimiento = this.toDateOnly(factura.vence);
        const diasAtraso = fechaVencimiento ? this.diffInDays(hoy, fechaVencimiento) : 0;
        const estaVencida = fechaVencimiento ? fechaVencimiento.getTime() < hoy.getTime() : false;

        return {
          folio: factura.numero.toString(),
          dias_atraso: Math.max(diasAtraso, 0),
          monto: montoPendiente,
          vencida: estaVencida,
        };
      })
      .filter((factura) => factura.vencida)
      .sort((a, b) => b.dias_atraso - a.dias_atraso || b.monto - a.monto)
      .map(({ folio, dias_atraso, monto }) => ({ folio, dias_atraso, monto }));

    const facturasVencidasCount = facturasVencidas.length;
    const diasMaximoAtraso = facturasVencidas.reduce((max, factura) => Math.max(max, factura.dias_atraso), 0);
    const totalAdeudo = saldoActual > 0
      ? saldoActual
      : this.toMoney(
          facturasAbiertas.reduce(
            (acc, factura) => acc + (this.toNumber(factura.total) - this.toNumber(factura.totalPagado)),
            0,
          ),
        );

    let estadoCredito = this.resolveEstadoCredito({
      activo,
      totalAdeudo,
      creditoDisponible,
      facturasVencidas: facturasVencidasCount,
      diasMaximoAtraso,
    });

    const excepcionActiva = await this.findExcepcionActiva(cliente.clienteId, cliente.numero);
    if (estadoCredito.clave === 'BLOQUEADO' && excepcionActiva) {
      estadoCredito = {
        clave: 'PERMITIDO TEMPORALMENTE',
        descripcion: 'Cliente bloqueado con excepción temporal autorizada',
        puede_generar_pedido: true,
        puede_generar_cotizacion: true,
        mensaje: this.buildMensajeExcepcion(excepcionActiva),
        reglaTipo: 'EXCEPCION CLIENTE CREDITO',
        reglaDetalle: `Existe una excepción activa para el cliente ${cliente.clienteId}${cliente.numero ? ` (${cliente.numero})` : ''}`,
      };
    }

    const domicilioFiscal = cliente.domicilioPrincipal ?? cliente.domicilios?.[0];

    return {
      cliente: {
        id: cliente.clienteId,
        nombre: cliente.nombre,
        rfc: domicilioFiscal?.rfc ?? null,
        activo,
        linea_credito: lineaCredito,
        saldo_actual: saldoActual,
        credito_disponible: creditoDisponible,
      },
      cobranza: {
        total_adeudo: totalAdeudo,
        facturas_vencidas: facturasVencidasCount,
        dias_maximo_atraso: diasMaximoAtraso,
        detalle_resumen: facturasVencidas,
      },
      estatus_credito: {
        clave: estadoCredito.clave,
        descripcion: estadoCredito.descripcion,
        puede_generar_pedido: estadoCredito.puede_generar_pedido,
        puede_generar_cotizacion: estadoCredito.puede_generar_cotizacion,
        mensaje: estadoCredito.mensaje,
      },
      reglas_aplicadas: {
        tipo: estadoCredito.reglaTipo,
        detalle: estadoCredito.reglaDetalle,
      },
    };
  }

  private resolveEstadoCredito(input: {
    activo: boolean;
    totalAdeudo: number;
    creditoDisponible: number;
    facturasVencidas: number;
    diasMaximoAtraso: number;
  }): EstadoCreditoResultado {
    const { activo, totalAdeudo, creditoDisponible, facturasVencidas, diasMaximoAtraso } = input;

    if (!activo) {
      return {
        clave: 'INACTIVO',
        descripcion: 'Cliente inactivo',
        puede_generar_pedido: false,
        puede_generar_cotizacion: true,
        mensaje: 'El cliente se encuentra inactivo. Solo se recomienda validar su estatus antes de continuar.',
        reglaTipo: 'CLIENTE INACTIVO',
        reglaDetalle: 'El campo ACTIVO del cliente no indica un registro habilitado',
      };
    }

    if (facturasVencidas > 0 && diasMaximoAtraso >= 8) {
      return {
        clave: 'BLOQUEADO',
        descripcion: 'Cliente con facturas vencidas mayores o iguales a 8 días',
        puede_generar_pedido: false,
        puede_generar_cotizacion: true,
        mensaje:
          'El cliente presenta atraso mayor o igual a 8 días. Solo puede generar cotización. Se recomienda realizar un pago o abono para habilitar pedidos.',
        reglaTipo: 'ATRASO MAYOR A 8 DÍAS',
        reglaDetalle: 'Existe al menos una factura con 8 días o más de atraso',
      };
    }

    if (facturasVencidas >= 2) {
      return {
        clave: creditoDisponible > 0 ? 'CONDICIONAL CREDITO' : 'SIN CREDITO DISPONIBLE',
        descripcion:
          creditoDisponible > 0
            ? 'Cliente con múltiples facturas vencidas menores a 8 días'
            : 'Cliente con múltiples facturas vencidas y sin crédito disponible',
        puede_generar_pedido: creditoDisponible > 0,
        puede_generar_cotizacion: true,
        mensaje:
          creditoDisponible > 0
            ? 'El cliente presenta mas de 2 facturas vencidas con atraso menor a 8 días. Puede generar pedido solo con el restante de su línea de crédito.'
            : 'El cliente presenta mas de 2 facturas vencidas y no cuenta con crédito disponible. Solo se recomienda generar cotización o solicitar abono.',
        reglaTipo: 'MULTIPLES VENCIDAS MENOR A 8 DÍAS',
        reglaDetalle: 'Existen dos o más facturas vencidas y ninguna alcanza el umbral de bloqueo',
      };
    }

    if (facturasVencidas === 1) {
      return {
        clave: 'VENCIMIENTO LEVE',
        descripcion: 'Cliente con una factura vencida y atraso menor a 8 días',
        puede_generar_pedido: true,
        puede_generar_cotizacion: true,
        mensaje:
          'El cliente presenta una factura vencida con atraso menor a 8 días. Puede generar pedido, pero se recomienda dar seguimiento a cobranza.',
        reglaTipo: 'UNA VENCIDA MENOR A 8 DÍAS',
        reglaDetalle: 'Existe exactamente una factura vencida y no supera el umbral de bloqueo',
      };
    }

    if (creditoDisponible < 0) {
      return {
        clave: 'LIMITE EXCEDIDO',
        descripcion: 'Límite de crédito excedido pero sin atraso',
        puede_generar_pedido: true,
        puede_generar_cotizacion: true,
        mensaje:
          'El cliente no tiene facturas vencidas, pero su saldo actual supera la línea de crédito. Puede generar pedido bajo validación comercial.',
        reglaTipo: 'LIMITE EXCEDIDO SIN ATRASO',
        reglaDetalle: 'No existen facturas vencidas, pero el saldo actual excede la línea de crédito',
      };
    }

    return {
      clave: 'AL DIA',
      descripcion: totalAdeudo > 0 ? 'Cliente al día y sin facturas vencidas' : 'Cliente al día sin adeudo',
      puede_generar_pedido: true,
      puede_generar_cotizacion: true,
      mensaje:
        totalAdeudo > 0
          ? 'El cliente tiene adeudo vigente, pero no presenta facturas vencidas. Puede generar pedido.'
          : 'El cliente no presenta adeudo ni facturas vencidas. Puede generar pedido con normalidad.',
      reglaTipo: totalAdeudo > 0 ? 'SIN ATRASO' : 'SIN ADEUDO',
      reglaDetalle:
        totalAdeudo > 0
          ? 'No existen facturas vencidas para el cliente'
          : 'El cliente no registra saldo pendiente ni facturas vencidas',
    };
  }

  private isClienteActivo(value: string | null | undefined): boolean {
    return ['S', 'A', '1', 'Y'].includes((value ?? '').trim().toUpperCase());
  }

  // private buildFolio(serie: string | null | undefined, numero: number | string | null | undefined): string {
  //   const cleanSerie = (serie ?? '').trim();
  //   const cleanNumero = `${numero ?? ''}`.trim();

  //   if (cleanSerie && cleanNumero) {
  //     return `${cleanSerie}-${cleanNumero}`;
  //   }

  //   return cleanSerie || cleanNumero || 'SIN-FOLIO';
  // }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private toDateOnly(value: Date | string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private diffInDays(dateA: Date, dateB: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((dateA.getTime() - dateB.getTime()) / msPerDay);
  }

  private toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private toMoney(value: string | number | null | undefined): number {
    return Number(this.toNumber(value).toFixed(2));
  }

  private async findExcepcionActiva(clienteId: number, numeroCliente: string | null | undefined) {
    const { start, end } = this.getTodayRange();
    const query = this.excepcionesRepository
      .createQueryBuilder('excepcion')
      .where('excepcion.createdAt >= :start', { start })
      .andWhere('excepcion.createdAt <= :end', { end });

    const numeroNormalizado = (numeroCliente ?? '').trim();
    if (numeroNormalizado) {
      query.andWhere('excepcion.numeroCliente = :numeroCliente', { numeroCliente: numeroNormalizado });
    } else {
      query.andWhere('excepcion.clienteId = :clienteId', { clienteId });
    }

    return query.orderBy('excepcion.updatedAt', 'DESC').getOne();
  }

  private buildMensajeExcepcion(excepcion: ClienteCreditoExcepcion): string {
    const numeroCliente = excepcion.numeroCliente?.trim();
    return `Cliente bloqueado, pero cuenta con excepción activa para hoy. Permitido temporalmente para generar pedido${numeroCliente ? ` (${numeroCliente})` : ''}.`;
  }

  private mapExcepcion(excepcion: ClienteCreditoExcepcion) {
    return {
      id: excepcion.id,
      clienteId: excepcion.clienteId,
      numeroCliente: excepcion.numeroCliente,
      createdAt: this.toIsoString(excepcion.createdAt),
      updatedAt: this.toIsoString(excepcion.updatedAt),
    };
  }

  private normalizeNumeroCliente(numeroCliente: string | null | undefined): string {
    const numeroNormalizado = (numeroCliente ?? '').trim();
    if (!numeroNormalizado) {
      throw new BadRequestException('El numeroCliente es requerido');
    }

    return numeroNormalizado;
  }

  private async findClienteByNumero(numeroCliente: string) {
    const cliente = await this.clientesRepository.findOne({
      where: { numero: numeroCliente },
      select: ['clienteId', 'numero'],
    });

    if (!cliente) {
      throw new NotFoundException(`No se encontró el cliente con numero ${numeroCliente}`);
    }

    return cliente;
  }

  private toIsoString(value: Date | null | undefined): string | null {
    return value ? new Date(value).toISOString() : null;
  }

  private getTodayRange() {
    const start = this.startOfToday();
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
}
