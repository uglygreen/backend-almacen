import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Cliente, CustomerNotificationType } from '../../entities';
import { CorreoLegacy } from '../../entities/correo-legacy.entity';
import { DomLegacy } from '../../entities/dom-legacy.entity';
import { Personal } from '../../entities/personal.entity';
import { ClientesCreditoService } from '../clientes-credito/clientes-credito.service';
import { CustomerNotificationsService } from '../customer-notifications/customer-notifications.service';
import { ClienteMobileOrderStatusHistory } from '../clientes-mobile-orders/entities/cliente-mobile-order-status-history.entity';
import { ClienteMobileOrder, ClienteMobileOrderStatus } from '../clientes-mobile-orders/entities/cliente-mobile-order.entity';
import { ClienteMobileOrderItem } from '../clientes-mobile-orders/entities/cliente-mobile-order-item.entity';
import {
  BackofficeCreditDto,
  BackofficeCustomerAddressDto,
  BackofficeCustomerDto,
  BackofficeOrderBillingDto,
  BackofficeOrderDeliveryDto,
  BackofficeOrderItemDto,
  BackofficeOrderStatusHistoryItemDto,
  BackofficeOrderSummaryDto,
  BackofficeSubmittedOrderDetailDto,
  BackofficeSubmittedOrderListItemDto,
} from './dto/backoffice-clientes-mobile-order-response.dto';
import { ListClientesMobileOrdersBackofficeDto } from './dto/list-clientes-mobile-orders-backoffice.dto';
import { UpdateClientesMobileOrderStatusDto } from './dto/update-clientes-mobile-order-status.dto';

@Injectable()
export class ClientesMobileOrdersBackofficeService {
  private readonly logger = new Logger(ClientesMobileOrdersBackofficeService.name);

  constructor(
    @InjectRepository(ClienteMobileOrder)
    private readonly ordersRepository: Repository<ClienteMobileOrder>,
    @InjectRepository(ClienteMobileOrderStatusHistory)
    private readonly orderStatusHistoryRepository: Repository<ClienteMobileOrderStatusHistory>,
    @InjectRepository(Cliente, 'legacy_db')
    private readonly clientesRepository: Repository<Cliente>,
    private readonly clientesCreditoService: ClientesCreditoService,
    private readonly customerNotificationsService: CustomerNotificationsService,
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
    const order = await this.findBackofficeOrderById(orderId);

    const cliente = await this.findClienteById(order.clienteId);
    const credit = order.creditSnapshot ?? await this.clientesCreditoService.getResumenCliente(order.clienteId);
    const history = await this.findOrderHistory(order.id);

    return {
      order: this.mapSubmittedOrderDetail(order, cliente, credit, history),
    };
  }

  async updateOrderStatus(orderId: number, dto: UpdateClientesMobileOrderStatusDto) {
    const order = await this.findBackofficeOrderById(orderId);
    const previousStatus = order.status;
    const nextStatus = dto.status;
    const notifyCustomer = dto.notifyCustomer ?? true;
    const changedBy = this.cleanNullableString(dto.changedBy) ?? 'backoffice';
    const customMessage = this.cleanNullableString(dto.message);

    if (previousStatus === nextStatus) {
      const history = await this.findOrderHistory(order.id);
      return {
        updated: false,
        reason: 'STATUS_UNCHANGED',
        order: {
          id: order.id,
          previousStatus,
          status: order.status,
          updatedAt: order.updatedAt,
        },
        history: history.map((item) => this.mapHistoryItem(item)),
        notification: {
          requested: false,
          sent: false,
          id: null,
        },
      };
    }

    this.assertValidStatusTransition(previousStatus, nextStatus);

    order.status = nextStatus;
    const savedOrder = await this.ordersRepository.save(order);

    const historyEntry = await this.orderStatusHistoryRepository.save(
      this.orderStatusHistoryRepository.create({
        orderId: savedOrder.id,
        previousStatus,
        status: nextStatus,
        message: customMessage ?? this.buildDefaultStatusMessage(savedOrder, nextStatus),
        changedBy,
        notifyCustomer,
        notificationId: null,
      }),
    );

    let notificationSummary = {
      requested: notifyCustomer,
      sent: false,
      id: null as number | null,
      status: null as string | null,
      errorCode: null as string | null,
      errorMessage: null as string | null,
    };

    if (notifyCustomer) {
      try {
        const notificationPayload = this.buildStatusNotificationPayload(savedOrder, historyEntry);
        const notificationResult = await this.customerNotificationsService.dispatchCustomerNotification(
          notificationPayload,
        );

        const notificationId = notificationResult.notification?.id ?? null;
        if (notificationId) {
          historyEntry.notificationId = notificationId;
          await this.orderStatusHistoryRepository.save(historyEntry);
        }

        notificationSummary = {
          requested: true,
          sent: Boolean(notificationResult.delivered),
          id: notificationId,
          status: notificationResult.notification?.status ?? null,
          errorCode: notificationResult.notification?.errorCode ?? null,
          errorMessage: notificationResult.notification?.errorMessage ?? null,
        };
      } catch (error: any) {
        this.logger.error(
          `No se pudo notificar el cambio de estatus del pedido ${savedOrder.id}: ${error?.message ?? error}`,
        );

        notificationSummary = {
          requested: true,
          sent: false,
          id: null,
          status: 'failed',
          errorCode: error?.code ?? 'ORDER_STATUS_NOTIFICATION_ERROR',
          errorMessage: error?.message ?? 'No se pudo enviar la notificación al cliente',
        };
      }
    }

    const history = await this.findOrderHistory(savedOrder.id);
    return {
      updated: true,
      order: {
        id: savedOrder.id,
        previousStatus,
        status: savedOrder.status,
        updatedAt: savedOrder.updatedAt,
      },
      historyEntry: this.mapHistoryItem(historyEntry),
      history: history.map((item) => this.mapHistoryItem(item)),
      notification: notificationSummary,
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
    history: ClienteMobileOrderStatusHistory[],
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
      history: history.map((item) => this.mapHistoryItem(item)),
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

  private mapHistoryItem(
    item: ClienteMobileOrderStatusHistory,
  ): BackofficeOrderStatusHistoryItemDto {
    return {
      id: item.id,
      previousStatus: item.previousStatus,
      status: item.status,
      message: this.cleanNullableString(item.message),
      changedBy: this.cleanNullableString(item.changedBy),
      notifyCustomer: Boolean(item.notifyCustomer),
      notificationId: item.notificationId ?? null,
      createdAt: item.createdAt,
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

  private async findBackofficeOrderById(orderId: number) {
    const order = await this.ordersRepository.findOne({
      where: {
        id: orderId,
        status: Not(ClienteMobileOrderStatus.DRAFT),
      },
      relations: ['items'],
      order: {
        items: {
          id: 'ASC',
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`No se encontró el pedido mobile ${orderId}`);
    }

    return order;
  }

  private async findOrderHistory(orderId: number) {
    return this.orderStatusHistoryRepository.find({
      where: { orderId },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
    });
  }

  private assertValidStatusTransition(
    currentStatus: ClienteMobileOrderStatus,
    nextStatus: ClienteMobileOrderStatus,
  ) {
    const allowedTransitions: Record<ClienteMobileOrderStatus, ClienteMobileOrderStatus[]> = {
      [ClienteMobileOrderStatus.DRAFT]: [],
      [ClienteMobileOrderStatus.SUBMITTED]: [
        ClienteMobileOrderStatus.ACCEPTED,
        ClienteMobileOrderStatus.CANCELLED,
      ],
      [ClienteMobileOrderStatus.ACCEPTED]: [
        ClienteMobileOrderStatus.PACKING,
        ClienteMobileOrderStatus.READY_TO_SHIP,
        ClienteMobileOrderStatus.CANCELLED,
      ],
      [ClienteMobileOrderStatus.PACKING]: [
        ClienteMobileOrderStatus.READY_TO_SHIP,
        ClienteMobileOrderStatus.CANCELLED,
      ],
      [ClienteMobileOrderStatus.READY_TO_SHIP]: [
        ClienteMobileOrderStatus.IN_ROUTE,
        ClienteMobileOrderStatus.DELIVERED,
        ClienteMobileOrderStatus.CANCELLED,
      ],
      [ClienteMobileOrderStatus.IN_ROUTE]: [
        ClienteMobileOrderStatus.DELIVERED,
        ClienteMobileOrderStatus.CANCELLED,
      ],
      [ClienteMobileOrderStatus.DELIVERED]: [],
      [ClienteMobileOrderStatus.CANCELLED]: [],
    };

    const allowedNextStatuses = allowedTransitions[currentStatus] ?? [];
    if (!allowedNextStatuses.includes(nextStatus)) {
      throw new BadRequestException(
        `No se permite cambiar el estatus de ${currentStatus} a ${nextStatus}`,
      );
    }
  }

  private buildStatusNotificationPayload(
    order: ClienteMobileOrder,
    historyEntry: ClienteMobileOrderStatusHistory,
  ) {
    const title = this.buildStatusNotificationTitle(order.status);
    const body = historyEntry.message ?? this.buildDefaultStatusMessage(order, order.status);
    const dedupeKey = `${CustomerNotificationType.ORDER_STATUS_UPDATED}:${order.id}:${historyEntry.id}`;

    return {
      customerId: order.clienteId,
      type: CustomerNotificationType.ORDER_STATUS_UPDATED,
      title,
      body,
      dedupeKey,
      scheduledFor: new Date(),
      metadata: {
        source: 'clientes_mobile_orders_backoffice',
        orderId: order.id,
        previousStatus: historyEntry.previousStatus,
        status: historyEntry.status,
        changedBy: historyEntry.changedBy,
      },
      data: {
        source: 'clientes_mobile_orders_backoffice',
        orderId: order.id,
        status: historyEntry.status,
        previousStatus: historyEntry.previousStatus,
      },
    };
  }

  private buildStatusNotificationTitle(status: ClienteMobileOrderStatus) {
    switch (status) {
      case ClienteMobileOrderStatus.ACCEPTED:
        return 'Tu pedido fue aceptado';
      case ClienteMobileOrderStatus.PACKING:
        return 'Tu pedido esta en surtido';
      case ClienteMobileOrderStatus.READY_TO_SHIP:
        return 'Tu pedido esta listo';
      case ClienteMobileOrderStatus.IN_ROUTE:
        return 'Tu pedido va en camino';
      case ClienteMobileOrderStatus.DELIVERED:
        return 'Tu pedido fue entregado';
      case ClienteMobileOrderStatus.CANCELLED:
        return 'Tu pedido fue cancelado';
      default:
        return 'Actualizacion de tu pedido';
    }
  }

  private buildDefaultStatusMessage(
    order: ClienteMobileOrder,
    status: ClienteMobileOrderStatus,
  ) {
    switch (status) {
      case ClienteMobileOrderStatus.ACCEPTED:
        return `Tu pedido #${order.id} fue aceptado y pronto comenzaremos a prepararlo.`;
      case ClienteMobileOrderStatus.PACKING:
        return `Tu pedido #${order.id} ya esta siendo surtido en almacen.`;
      case ClienteMobileOrderStatus.READY_TO_SHIP:
        return order.deliveryType === 'PICKUP'
          ? `Tu pedido #${order.id} ya esta listo para recoger en oficina.`
          : `Tu pedido #${order.id} ya esta listo para envio.`;
      case ClienteMobileOrderStatus.IN_ROUTE:
        return `Tu pedido #${order.id} ya va en camino.`;
      case ClienteMobileOrderStatus.DELIVERED:
        return `Tu pedido #${order.id} fue entregado correctamente.`;
      case ClienteMobileOrderStatus.CANCELLED:
        return `Tu pedido #${order.id} fue cancelado.`;
      default:
        return `El estatus de tu pedido #${order.id} cambio a ${status}.`;
    }
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
