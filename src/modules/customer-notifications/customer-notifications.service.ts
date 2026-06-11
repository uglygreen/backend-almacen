import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CustomerNotification,
  CustomerNotificationStatus,
  CustomerNotificationType,
  DeviceToken,
} from '../../entities';
import { DeactivateDeviceTokenDto } from './dto/deactivate-device-token.dto';
import { ListCustomerNotificationsDto } from './dto/list-customer-notifications.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { SendTestPushDto } from './dto/send-test-push.dto';
import { PushNotificationService } from './push-notification.service';

type DispatchCustomerNotificationInput = {
  customerId: number;
  type: CustomerNotificationType;
  title: string;
  body: string;
  dedupeKey: string;
  scheduledFor?: Date | null;
  metadata?: Record<string, any> | null;
  data?: Record<string, unknown>;
};

@Injectable()
export class CustomerNotificationsService {
  private readonly logger = new Logger(CustomerNotificationsService.name);

  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokensRepository: Repository<DeviceToken>,
    @InjectRepository(CustomerNotification)
    private readonly notificationsRepository: Repository<CustomerNotification>,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  async registerDeviceToken(customerId: number, dto: RegisterDeviceTokenDto) {
    const now = new Date();
    const fcmToken = dto.fcmToken.trim();
    const existing = await this.deviceTokensRepository.findOne({
      where: { fcmToken },
    });

    const entity = existing ?? this.deviceTokensRepository.create();
    entity.customerId = customerId;
    entity.fcmToken = fcmToken;
    entity.platform = dto.platform.trim().toLowerCase();
    entity.deviceName = dto.deviceName?.trim() || null;
    entity.appVersion = dto.appVersion?.trim() || null;
    entity.isActive = true;
    entity.lastSeenAt = now;

    const saved = await this.deviceTokensRepository.save(entity);
    return {
      registered: true,
      token: this.mapDeviceToken(saved),
    };
  }

  async deactivateDeviceToken(customerId: number, dto: DeactivateDeviceTokenDto) {
    const deviceToken = await this.deviceTokensRepository.findOne({
      where: {
        customerId,
        fcmToken: dto.fcmToken.trim(),
      },
    });

    if (!deviceToken) {
      return {
        deactivated: false,
        reason: 'TOKEN_NOT_FOUND',
      };
    }

    deviceToken.isActive = false;
    const saved = await this.deviceTokensRepository.save(deviceToken);
    return {
      deactivated: true,
      token: this.mapDeviceToken(saved),
    };
  }

  async listCustomerNotifications(customerId: number, query: ListCustomerNotificationsDto) {
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;

    const qb = this.notificationsRepository
      .createQueryBuilder('notification')
      .where('notification.customerId = :customerId', { customerId })
      .andWhere('notification.deletedByUser = :deletedByUser', { deletedByUser: false })
      .orderBy('notification.createdAt', 'DESC')
      .offset(offset)
      .limit(limit);

    if (query.unreadOnly) {
      qb.andWhere('notification.readAt IS NULL');
    }

    const [items, total] = await qb.getManyAndCount();
    const unread = await this.notificationsRepository
      .createQueryBuilder('notification')
      .where('notification.customerId = :customerId', { customerId })
      .andWhere('notification.deletedByUser = :deletedByUser', { deletedByUser: false })
      .andWhere('notification.readAt IS NULL')
      .getCount();

    return {
      items: items.map((item) => this.mapNotification(item)),
      pagination: {
        offset,
        limit,
        total,
        unread,
      },
    };
  }

  async markAsRead(customerId: number, notificationId: number) {
    const notification = await this.findNotificationOrFail(customerId, notificationId);
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationsRepository.save(notification);
    }

    return {
      updated: true,
      notification: this.mapNotification(notification),
    };
  }

  async deleteFromHistory(customerId: number, notificationId: number) {
    const notification = await this.findNotificationOrFail(customerId, notificationId);
    notification.deletedByUser = true;
    await this.notificationsRepository.save(notification);

    return {
      deleted: true,
      id: notification.id,
    };
  }

  async sendTestPush(customerId: number, dto: SendTestPushDto) {
    const now = new Date();
    const title = dto.title?.trim() || 'Prueba push desde backend';
    const body = dto.body?.trim() || 'Esta es una notificacion de prueba enviada manualmente.';
    const dedupeKey = `${CustomerNotificationType.TEST_PUSH}:${customerId}:${now.getTime()}`;

    const result = await this.dispatchCustomerNotification({
      customerId,
      type: CustomerNotificationType.TEST_PUSH,
      title,
      body,
      dedupeKey,
      scheduledFor: now,
      metadata: {
        source: 'manual_test_endpoint',
        requestedAt: now.toISOString(),
      },
      data: {
        source: 'manual_test_endpoint',
        requestedAt: now.toISOString(),
        ...(dto.data ?? {}),
      },
    });

    return {
      sent: !result.skipped && result.delivered,
      skipped: result.skipped,
      reason: result.reason ?? null,
      notification: result.notification,
    };
  }

  async dispatchCustomerNotification(input: DispatchCustomerNotificationInput) {
    let notification = this.notificationsRepository.create({
      customerId: input.customerId,
      type: input.type,
      title: input.title,
      body: input.body,
      dedupeKey: input.dedupeKey,
      metadataJson: input.metadata ?? null,
      scheduledFor: input.scheduledFor ?? null,
      sentAt: null,
      readAt: null,
      deletedByUser: false,
      status: CustomerNotificationStatus.PENDING,
      fcmMessageIds: null,
      errorCode: null,
      errorMessage: null,
    });

    try {
      notification = await this.notificationsRepository.save(notification);
    } catch (error: any) {
      if (this.isDuplicateKeyError(error)) {
        this.logger.debug(`Notificacion duplicada omitida por dedupe_key=${input.dedupeKey}`);
        const existing = await this.notificationsRepository.findOne({
          where: { dedupeKey: input.dedupeKey },
        });

        return {
          skipped: true,
          reason: 'DUPLICATE',
          notification: existing ? this.mapNotification(existing) : null,
        };
      }

      throw error;
    }

    const tokens = await this.deviceTokensRepository.find({
      where: {
        customerId: input.customerId,
        isActive: true,
      },
    });

    if (!tokens.length) {
      notification.status = CustomerNotificationStatus.FAILED;
      notification.errorCode = 'NO_ACTIVE_TOKENS';
      notification.errorMessage = 'No hay tokens FCM activos para el cliente';
      notification.metadataJson = this.mergeMetadata(notification.metadataJson, {
        delivery: {
          successCount: 0,
          failureCount: 0,
          invalidTokenIds: [],
        },
      });
      await this.notificationsRepository.save(notification);
      this.logger.warn(`No hay tokens activos para cliente ${input.customerId}. Notificacion ${notification.id}.`);

      return {
        skipped: false,
        delivered: false,
        notification: this.mapNotification(notification),
      };
    }

    try {
      const result = await this.pushNotificationService.sendToDevices({
        customerId: input.customerId,
        notificationId: notification.id,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data,
        tokens,
      });

      if (result.invalidTokenIds.length) {
        await this.deviceTokensRepository.update(
          { id: In(result.invalidTokenIds) },
          { isActive: false },
        );
        this.logger.warn(
          `Tokens invalidados para cliente ${input.customerId}: ${result.invalidTokenIds.join(', ')}`,
        );
      }

      notification.fcmMessageIds = result.messageIds;
      notification.metadataJson = this.mergeMetadata(notification.metadataJson, {
        delivery: {
          successCount: result.successCount,
          failureCount: result.failureCount,
          invalidTokenIds: result.invalidTokenIds,
          failures: result.failures,
        },
      });

      if (result.successCount > 0) {
        notification.status = CustomerNotificationStatus.SENT;
        notification.sentAt = new Date();
        notification.errorCode = result.failureCount > 0 ? 'PARTIAL_FAILURE' : null;
        notification.errorMessage = result.failureCount > 0 ? 'Uno o más tokens fallaron durante el envio' : null;
      } else {
        notification.status = CustomerNotificationStatus.FAILED;
        notification.errorCode = result.failures[0]?.code ?? 'FCM_SEND_FAILED';
        notification.errorMessage = result.failures[0]?.message ?? 'FCM no pudo entregar el mensaje';
      }

      const saved = await this.notificationsRepository.save(notification);
      return {
        skipped: false,
        delivered: result.successCount > 0,
        notification: this.mapNotification(saved),
      };
    } catch (error: any) {
      notification.status = CustomerNotificationStatus.FAILED;
      notification.errorCode = error?.code ?? 'FCM_UNEXPECTED_ERROR';
      notification.errorMessage = error?.message ?? 'Error no controlado enviando push';
      const saved = await this.notificationsRepository.save(notification);

      this.logger.error(
        `Error enviando push al cliente ${input.customerId}. Notificacion ${notification.id}. ${notification.errorMessage}`,
      );

      return {
        skipped: false,
        delivered: false,
        notification: this.mapNotification(saved),
      };
    }
  }

  async getCustomersWithActiveTokens() {
    const rows = await this.deviceTokensRepository
      .createQueryBuilder('token')
      .select('token.customerId', 'customerId')
      .where('token.isActive = :isActive', { isActive: true })
      .groupBy('token.customerId')
      .getRawMany<{ customerId: string }>();

    return rows
      .map((row) => Number(row.customerId))
      .filter((value) => Number.isFinite(value) && value > 0);
  }

  async getLastSentNotificationsByType(customerIds: number[], type: CustomerNotificationType) {
    if (!customerIds.length) {
      return new Map<number, CustomerNotification>();
    }

    const rows = await this.notificationsRepository
      .createQueryBuilder('notification')
      .where('notification.customerId IN (:...customerIds)', { customerIds })
      .andWhere('notification.type = :type', { type })
      .andWhere('notification.status = :status', { status: CustomerNotificationStatus.SENT })
      .andWhere('notification.sentAt IS NOT NULL')
      .orderBy('notification.customerId', 'ASC')
      .addOrderBy('notification.sentAt', 'DESC')
      .getMany();

    const latestByCustomer = new Map<number, CustomerNotification>();
    for (const row of rows) {
      if (!latestByCustomer.has(row.customerId)) {
        latestByCustomer.set(row.customerId, row);
      }
    }

    return latestByCustomer;
  }

  private async findNotificationOrFail(customerId: number, notificationId: number) {
    const notification = await this.notificationsRepository.findOne({
      where: {
        id: notificationId,
        customerId,
        deletedByUser: false,
      },
    });

    if (!notification) {
      throw new NotFoundException(`No se encontró la notificación ${notificationId}`);
    }

    return notification;
  }

  private mergeMetadata(
    current: Record<string, any> | null,
    patch: Record<string, any>,
  ): Record<string, any> {
    return {
      ...(current ?? {}),
      ...patch,
    };
  }

  private isDuplicateKeyError(error: any) {
    return error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062;
  }

  private mapDeviceToken(token: DeviceToken) {
    return {
      id: token.id,
      customerId: token.customerId,
      platform: token.platform,
      deviceName: token.deviceName,
      appVersion: token.appVersion,
      isActive: token.isActive,
      lastSeenAt: token.lastSeenAt,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    };
  }

  private mapNotification(notification: CustomerNotification) {
    return {
      id: notification.id,
      customerId: notification.customerId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      dedupeKey: notification.dedupeKey,
      metadata: notification.metadataJson,
      scheduledFor: notification.scheduledFor,
      sentAt: notification.sentAt,
      readAt: notification.readAt,
      deletedByUser: notification.deletedByUser,
      status: notification.status,
      fcmMessageIds: notification.fcmMessageIds,
      errorCode: notification.errorCode,
      errorMessage: notification.errorMessage,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }
}
