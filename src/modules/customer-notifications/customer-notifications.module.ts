import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Cliente,
  ClienteMobileSession,
  CustomerNotification,
  DeviceToken,
  DocLegacy,
  PagoLegacy,
  PaymentNotificationCheckpoint,
} from '../../entities';
import { ClientesMobileModule } from '../clientes-mobile/clientes-mobile.module';
import { CustomerNotificationsController } from './customer-notifications.controller';
import { CustomerNotificationsService } from './customer-notifications.service';
import { OverdueInvoicesNotificationJob } from './overdue-invoices-notification.job';
import { PaymentNotificationJob } from './payment-notification.job';
import { PushNotificationService } from './push-notification.service';
import { VisitDayNotificationJob } from './visit-day-notification.job';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeviceToken,
      CustomerNotification,
      ClienteMobileSession,
      PaymentNotificationCheckpoint,
    ]),
    TypeOrmModule.forFeature([Cliente, DocLegacy, PagoLegacy], 'legacy_db'),
    ClientesMobileModule,
  ],
  controllers: [CustomerNotificationsController],
  providers: [
    CustomerNotificationsService,
    PushNotificationService,
    VisitDayNotificationJob,
    OverdueInvoicesNotificationJob,
    PaymentNotificationJob,
  ],
  exports: [CustomerNotificationsService, PushNotificationService],
})
export class CustomerNotificationsModule {}
