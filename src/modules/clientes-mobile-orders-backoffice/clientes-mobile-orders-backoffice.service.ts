import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Cliente } from '../../entities';
import { CorreoLegacy } from '../../entities/correo-legacy.entity';
import { DomLegacy } from '../../entities/dom-legacy.entity';
import { Personal } from '../../entities/personal.entity';
import { ClientesCreditoService } from '../clientes-credito/clientes-credito.service';
import { ClienteMobileOrder, ClienteMobileOrderStatus } from '../clientes-mobile-orders/entities/cliente-mobile-order.entity';
import { ClienteMobileOrderItem } from '../clientes-mobile-orders/entities/cliente-mobile-order-item.entity';
import {
  BackofficeCreditDto,
  BackofficeCustomerAddressDto,
  BackofficeCustomerDto,
  BackofficeOrderBillingDto,
  BackofficeOrderDeliveryDto,
  BackofficeOrderItemDto,
  BackofficeOrderSummaryDto,
  BackofficeSubmittedOrderDetailDto,
  BackofficeSubmittedOrderListItemDto,
} from './dto/backoffice-clientes-mobile-order-response.dto';
import { ListClientesMobileOrdersBackofficeDto } from './dto/list-clientes-mobile-orders-backoffice.dto';

@Injectable()
export class ClientesMobileOrdersBackofficeService {
  constructor(
    @InjectRepository(ClienteMobileOrder)
    private readonly ordersRepository: Repository<ClienteMobileOrder>,
    @InjectRepository(Cliente, 'legacy_db')
    private readonly clientesRepository: Repository<Cliente>,
    private readonly clientesCreditoService: ClientesCreditoService,
  ) {}

  async listSubmittedOrders(query: ListClientesMobileOrdersBackofficeDto) {
    const limit = query.limit ?? 50;
    const normalizedCustomer = this.normalizeNumeroCliente(query.customer);
    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.status = :status', {
        status: ClienteMobileOrderStatus.SUBMITTED,
      })
      .orderBy('order.submittedAt', 'DESC')
      .addOrderBy('order.id', 'DESC')
      .take(limit);

    if (query.clienteId) {
      qb.andWhere('order.clienteId = :clienteId', { clienteId: query.clienteId });
    }

    if (normalizedCustomer) {
      qb.andWhere('order.clienteNumero = :clienteNumero', {
        clienteNumero: normalizedCustomer,
      });
    }

    const orders = await qb.getMany();
    const clientesById = await this.findClientesByIds(orders.map((order) => order.clienteId));

    return {
      items: orders.map((order) =>
        this.mapSubmittedOrderListItem(order, clientesById.get(order.clienteId) ?? null),
      ),
    };
  }

  async getSubmittedOrderDetail(orderId: number) {
    const order = await this.ordersRepository.findOne({
      where: {
        id: orderId,
        status: ClienteMobileOrderStatus.SUBMITTED,
      },
      relations: ['items'],
      order: {
        items: {
          id: 'ASC',
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`No se encontró el pedido enviado ${orderId}`);
    }

    const cliente = await this.findClienteById(order.clienteId);
    const credit = order.creditSnapshot ?? await this.clientesCreditoService.getResumenCliente(order.clienteId);

    return {
      order: this.mapSubmittedOrderDetail(order, cliente, credit),
    };
  }

  private async findClientesByIds(clienteIds: number[]) {
    const uniqueIds = [...new Set(clienteIds.filter((id) => Number.isFinite(id) && id > 0))];
    if (!uniqueIds.length) {
      return new Map<number, Cliente>();
    }

    const clientes = await this.clientesRepository.find({
      where: {
        clienteId: In(uniqueIds),
      },
      relations: ['domicilioPrincipal', 'correos'],
    });

    return new Map(clientes.map((cliente) => [cliente.clienteId, cliente]));
  }

  private async findClienteById(clienteId: number) {
    const cliente = await this.clientesRepository.findOne({
      where: { clienteId },
      relations: [
        'domicilioPrincipal',
        'domicilios',
        'correos',
        'vendedorDetalle',
        'cobradorDetalle',
      ],
    });

    if (!cliente) {
      throw new NotFoundException(`No se encontró el cliente ${clienteId}`);
    }

    return cliente;
  }

  private mapSubmittedOrderListItem(
    order: ClienteMobileOrder,
    cliente: Cliente | null,
  ): BackofficeSubmittedOrderListItemDto {
    return {
      id: order.id,
      status: order.status,
      submittedAt: order.submittedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customer: this.mapCustomer(cliente, order),
      billing: this.mapBilling(order),
      delivery: this.mapDelivery(order),
      summary: this.mapSummary(order),
    };
  }

  private mapSubmittedOrderDetail(
    order: ClienteMobileOrder,
    cliente: Cliente,
    creditSource: any,
  ): BackofficeSubmittedOrderDetailDto {
    return {
      id: order.id,
      status: order.status,
      submittedAt: order.submittedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      nota: this.cleanNullableString(order.nota),
      customer: this.mapCustomer(cliente, order),
      billing: this.mapBilling(order),
      delivery: this.mapDelivery(order),
      summary: this.mapSummary(order),
      credit: this.mapCredit(creditSource),
      items: (order.items ?? []).map((item) => this.mapItem(item)),
    };
  }

  private mapCustomer(cliente: Cliente | null, order: ClienteMobileOrder): BackofficeCustomerDto {
    const primaryAddress = cliente?.domicilioPrincipal;
    const email = this.resolvePrimaryEmail(cliente?.correos ?? []);

    return {
      id: cliente?.clienteId ?? order.clienteId,
      numero: this.cleanNullableString(cliente?.numero) ?? order.clienteNumero,
      nombre: this.cleanNullableString(cliente?.nombre),
      activo: this.isClienteActivo(cliente?.activo),
      email,
      descuento: cliente ? this.toMoney(cliente.descuento) : null,
      descuentoCredito: cliente ? this.toMoney(cliente.desCred) : null,
      vendedor: this.mapPerson(cliente?.vendedorDetalle),
      cobrador: this.mapPerson(cliente?.cobradorDetalle),
      direccionPrincipal: primaryAddress ? this.mapAddress(primaryAddress) : null,
    };
  }

  private mapBilling(order: ClienteMobileOrder): BackofficeOrderBillingDto {
    return {
      rfc: this.cleanNullableString(order.rfc),
      cfdiUse: this.cleanNullableString(order.cfdiUse),
    };
  }

  private mapDelivery(order: ClienteMobileOrder): BackofficeOrderDeliveryDto {
    return {
      type: order.deliveryType,
      addressId: order.addressId,
      address: this.mapOrderAddressSnapshot(order.addressSnapshot),
    };
  }

  private mapSummary(order: ClienteMobileOrder): BackofficeOrderSummaryDto {
    return {
      itemsCount: order.items?.length ?? 0,
      subtotal: this.toMoney(order.subtotal),
      iva: this.toMoney(order.iva),
      total: this.toMoney(order.total),
    };
  }

  private mapItem(item: ClienteMobileOrderItem): BackofficeOrderItemDto {
    return {
      id: item.id,
      productId: item.productId,
      sku: item.sku,
      descripcion: item.descripcion,
      imagen: item.imagen,
      claveProdServ: item.claveProdServ,
      claveUnidad: item.claveUnidad,
      unidad: item.unidad,
      almacen: item.almacen,
      cantidad: this.toNumber(item.cantidad),
      lote: item.lote,
      precioUnitario: this.toNumber(item.precioUnitario),
      subtotal: this.toMoney(item.subtotal),
      iva: this.toMoney(item.iva),
      total: this.toMoney(item.total),
    };
  }

  private mapCredit(creditSource: any): BackofficeCreditDto | null {
    if (!creditSource) {
      return null;
    }

    return {
      capturedAt: creditSource.capturedAt ?? null,
      customer: creditSource.cliente
        ? {
            id: this.toNullableNumber(creditSource.cliente.id),
            nombre: this.cleanNullableString(creditSource.cliente.nombre),
            rfc: this.cleanNullableString(creditSource.cliente.rfc),
            activo: this.toNullableBoolean(creditSource.cliente.activo),
            lineaCredito: this.toNullableMoney(creditSource.cliente.linea_credito),
            saldoActual: this.toNullableMoney(creditSource.cliente.saldo_actual),
            creditoDisponible: this.toNullableMoney(creditSource.cliente.credito_disponible),
          }
        : null,
      accountsReceivable: creditSource.cobranza
        ? {
            totalAdeudo: this.toNullableMoney(creditSource.cobranza.total_adeudo),
            facturasVencidas: this.toNullableNumber(creditSource.cobranza.facturas_vencidas),
            diasMaximoAtraso: this.toNullableNumber(creditSource.cobranza.dias_maximo_atraso),
            detalleResumen: Array.isArray(creditSource.cobranza.detalle_resumen)
              ? creditSource.cobranza.detalle_resumen
              : [],
          }
        : null,
      status: creditSource.estatus_credito
        ? {
            clave: this.cleanNullableString(creditSource.estatus_credito.clave),
            descripcion: this.cleanNullableString(creditSource.estatus_credito.descripcion),
            puedeGenerarPedido: this.toNullableBoolean(
              creditSource.estatus_credito.puede_generar_pedido,
            ),
            puedeGenerarCotizacion: this.toNullableBoolean(
              creditSource.estatus_credito.puede_generar_cotizacion,
            ),
            mensaje: this.cleanNullableString(creditSource.estatus_credito.mensaje),
          }
        : null,
      rules: creditSource.reglas_aplicadas
        ? {
            tipo: this.cleanNullableString(creditSource.reglas_aplicadas.tipo),
            detalle: this.cleanNullableString(creditSource.reglas_aplicadas.detalle),
          }
        : null,
    };
  }

  private mapAddress(address: DomLegacy): BackofficeCustomerAddressDto {
    return {
      id: address.domId,
      nombre: this.cleanNullableString(address.nombre),
      nombreComercial: this.cleanNullableString(address.nombreCom),
      direccion: this.cleanNullableString(address.direccion),
      numero: this.cleanNullableString(address.numero),
      interior: this.cleanNullableString(address.interior),
      colonia: this.cleanNullableString(address.colonia),
      ciudad: this.cleanNullableString(address.ciudad),
      municipio: this.cleanNullableString(address.municipio),
      estado: this.cleanNullableString(address.estado),
      pais: this.cleanNullableString(address.pais),
      referencia: this.cleanNullableString(address.referencia),
      cp: this.cleanNullableString(address.cp),
      rfc: this.cleanNullableString(address.rfc),
      regimen: this.cleanNullableString(address.domRegimen),
      medio: this.cleanNullableString(address.medio),
      validado: this.cleanNullableString(address.validado),
    };
  }

  private mapOrderAddressSnapshot(snapshot: Record<string, any> | null | undefined) {
    if (!snapshot) {
      return null;
    }

    return {
      id: this.toNumber(snapshot.id),
      nombre: this.cleanNullableString(snapshot.nombre),
      nombreComercial: this.cleanNullableString(snapshot.nombreComercial),
      direccion: this.cleanNullableString(snapshot.direccion),
      numero: this.cleanNullableString(snapshot.numero),
      interior: this.cleanNullableString(snapshot.interior),
      colonia: this.cleanNullableString(snapshot.colonia),
      ciudad: this.cleanNullableString(snapshot.ciudad),
      municipio: this.cleanNullableString(snapshot.municipio),
      estado: this.cleanNullableString(snapshot.estado),
      pais: this.cleanNullableString(snapshot.pais),
      referencia: this.cleanNullableString(snapshot.referencia),
      cp: this.cleanNullableString(snapshot.cp),
      rfc: this.cleanNullableString(snapshot.rfc),
      regimen: this.cleanNullableString(snapshot.regimen),
      medio: this.cleanNullableString(snapshot.medio),
      validado: this.cleanNullableString(snapshot.validado),
    };
  }

  private mapPerson(person: Personal | null | undefined) {
    if (!person) {
      return null;
    }

    return {
      id: person.perId,
      nombre: this.cleanNullableString(person.nombre) ?? `Personal ${person.perId}`,
    };
  }

  private resolvePrimaryEmail(correos: CorreoLegacy[]) {
    const preferred = correos.find((correo) => this.cleanNullableString(correo.cEnviar) === 'S');
    const selected = preferred ?? correos[0];
    return this.cleanNullableString(selected?.correo);
  }

  private normalizeNumeroCliente(value: string | null | undefined) {
    const normalized = (value ?? '').trim();
    return normalized || null;
  }

  private cleanNullableString(value: string | null | undefined) {
    const normalized = (value ?? '').trim();
    return normalized || null;
  }

  private isClienteActivo(value: string | null | undefined) {
    return (value ?? '').trim().toUpperCase() === 'A';
  }

  private toNumber(value: unknown) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private toNullableNumber(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private toMoney(value: unknown) {
    return Math.round((this.toNumber(value) + Number.EPSILON) * 100) / 100;
  }

  private toNullableMoney(value: unknown) {
    const numeric = this.toNullableNumber(value);
    if (numeric === null) {
      return null;
    }

    return Math.round((numeric + Number.EPSILON) * 100) / 100;
  }

  private toNullableBoolean(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 's', 'si', 'y', 'yes'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'n', 'no'].includes(normalized)) {
      return false;
    }

    return null;
  }
}
