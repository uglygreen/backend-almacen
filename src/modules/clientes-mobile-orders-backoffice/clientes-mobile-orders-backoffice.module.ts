import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from '../../entities';
import { CustomerNotificationsModule } from '../customer-notifications/customer-notifications.module';
import { ClientesCreditoModule } from '../clientes-credito/clientes-credito.module';
import { ClienteMobileOrder } from '../clientes-mobile-orders/entities/cliente-mobile-order.entity';
import { ClienteMobileOrderStatusHistory } from '../clientes-mobile-orders/entities/cliente-mobile-order-status-history.entity';
import { ClientesMobileOrdersBackofficeController } from './clientes-mobile-orders-backoffice.controller';
import { ClientesMobileOrdersBackofficeService } from './clientes-mobile-orders-backoffice.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClienteMobileOrder, ClienteMobileOrderStatusHistory]),
    TypeOrmModule.forFeature([Cliente], 'legacy_db'),
    ClientesCreditoModule,
    CustomerNotificationsModule,
  ],
  controllers: [ClientesMobileOrdersBackofficeController],
  providers: [ClientesMobileOrdersBackofficeService],
})
export class ClientesMobileOrdersBackofficeModule {}
