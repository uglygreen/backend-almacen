import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerNotificationType } from '../../entities';
import { CustomerNotificationsService } from '../customer-notifications/customer-notifications.service';
import { ClienteMobileOrderStatusHistory } from './entities/cliente-mobile-order-status-history.entity';
import {
  ClienteMobileOrder,
  ClienteMobileOrderDeliveryType,
  ClienteMobileOrderStatus,
} from './entities/cliente-mobile-order.entity';

type WorkflowChangeSource = 'manual' | 'sync';

type ChangeOrderStatusInput = {
  orderId: number;
  nextStatus: ClienteMobileOrderStatus;
  changedBy?: string | null;
  message?: string | null;
  notifyCustomer?: boolean;
  source?: WorkflowChangeSource;
  metadataSource?: string;
};

@Injectable()
export class ClientesMobileOrderWorkflowService {
  private readonly logger = new Logger(ClientesMobileOrderWorkflowService.name);

  constructor(
    @InjectRepository(ClienteMobileOrder)
    private readonly ordersRepository: Repository<ClienteMobileOrder>,
    @InjectRepository(ClienteMobileOrderStatusHistory)
    private readonly orderStatusHistoryRepository: Repository<ClienteMobileOrderStatusHistory>,
    private readonly customerNotificationsService: CustomerNotificationsService,
  ) {}

  async changeOrderStatus(input: ChangeOrderStatusInput) {
    const order = await this.ordersRepository.findOne({
      where: { id: input.orderId },
    });

    if (!order) {
      throw new NotFoundException(`No se encontró el pedido mobile ${input.orderId}`);
    }

    const previousStatus = order.status;
    const nextStatus = input.nextStatus;
    const source = input.source ?? 'manual';
    const notifyCustomer = input.notifyCustomer ?? true;
    const changedBy = this.cleanNullableString(input.changedBy)
      ?? (source === 'sync' ? 'sincronizacion' : 'backoffice');
    const customMessage = this.cleanNullableString(input.message);

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
        history,
        notification: {
          requested: false,
          sent: false,
          id: null,
        },
      };
    }

    this.assertValidStatusTransition(previousStatus, nextStatus, source);

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
        const notificationResult = await this.customerNotificationsService.dispatchCustomerNotification(
          this.buildStatusNotificationPayload(
            savedOrder,
            historyEntry,
            input.metadataSource ?? `clientes_mobile_orders_${source}`,
          ),
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

    return {
      updated: true,
      order: {
        id: savedOrder.id,
        previousStatus,
        status: savedOrder.status,
        updatedAt: savedOrder.updatedAt,
      },
      historyEntry,
      history: await this.findOrderHistory(savedOrder.id),
      notification: notificationSummary,
    };
  }

  async findOrderHistory(orderId: number) {
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
    source: WorkflowChangeSource,
  ) {
    const manualTransitions: Record<ClienteMobileOrderStatus, ClienteMobileOrderStatus[]> = {
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

    const syncTransitions: Record<ClienteMobileOrderStatus, ClienteMobileOrderStatus[]> = {
      [ClienteMobileOrderStatus.DRAFT]: [],
      [ClienteMobileOrderStatus.SUBMITTED]: [
        ClienteMobileOrderStatus.PACKING,
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
      [ClienteMobileOrderStatus.READY_TO_SHIP]: [ClienteMobileOrderStatus.CANCELLED],
      [ClienteMobileOrderStatus.IN_ROUTE]: [],
      [ClienteMobileOrderStatus.DELIVERED]: [],
      [ClienteMobileOrderStatus.CANCELLED]: [],
    };

    const transitions = source === 'sync' ? syncTransitions : manualTransitions;
    const allowedNextStatuses = transitions[currentStatus] ?? [];
    if (!allowedNextStatuses.includes(nextStatus)) {
      throw new BadRequestException(
        `No se permite cambiar el estatus de ${currentStatus} a ${nextStatus}`,
      );
    }
  }

  private buildStatusNotificationPayload(
    order: ClienteMobileOrder,
    historyEntry: ClienteMobileOrderStatusHistory,
    metadataSource: string,
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
        source: metadataSource,
        orderId: order.id,
        previousStatus: historyEntry.previousStatus,
        status: historyEntry.status,
        changedBy: historyEntry.changedBy,
      },
      data: {
        source: metadataSource,
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
        return order.deliveryType === ClienteMobileOrderDeliveryType.PICKUP
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

  private cleanNullableString(value: string | null | undefined) {
    const normalized = (value ?? '').trim();
    return normalized || null;
  }
}
