import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente, ClienteMobileSession } from '../../entities';
import { ClientesCreditoModule } from '../clientes-credito/clientes-credito.module';
import { ClientesMobileModule } from '../clientes-mobile/clientes-mobile.module';
import { CustomerNotificationsModule } from '../customer-notifications/customer-notifications.module';
import { ClientesMobileOrderWorkflowService } from './clientes-mobile-order-workflow.service';
import { ClientesMobileOrdersController } from './clientes-mobile-orders.controller';
import { ClientesMobileOrdersService } from './clientes-mobile-orders.service';
import { ClienteMobileOrderLegacyDocument } from './entities/cliente-mobile-order-legacy-document.entity';
import { ClienteMobileOrder } from './entities/cliente-mobile-order.entity';
import { ClienteMobileOrderItem } from './entities/cliente-mobile-order-item.entity';
import { ClienteMobileOrderStatusHistory } from './entities/cliente-mobile-order-status-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClienteMobileOrder,
      ClienteMobileOrderItem,
      ClienteMobileOrderStatusHistory,
      ClienteMobileOrderLegacyDocument,
    ]),
    TypeOrmModule.forFeature([ClienteMobileSession]),
    TypeOrmModule.forFeature([Cliente], 'legacy_db'),
    ClientesMobileModule,
    ClientesCreditoModule,
    CustomerNotificationsModule,
  ],
  controllers: [ClientesMobileOrdersController],
  providers: [ClientesMobileOrdersService, ClientesMobileOrderWorkflowService],
  exports: [ClientesMobileOrdersService, ClientesMobileOrderWorkflowService],
})
export class ClientesMobileOrdersModule {}
