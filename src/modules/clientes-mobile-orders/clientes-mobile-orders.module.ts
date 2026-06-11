import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente, ClienteMobileSession } from '../../entities';
import { ClientesCreditoModule } from '../clientes-credito/clientes-credito.module';
import { ClientesMobileModule } from '../clientes-mobile/clientes-mobile.module';
import { ClientesMobileOrdersController } from './clientes-mobile-orders.controller';
import { ClientesMobileOrdersService } from './clientes-mobile-orders.service';
import { ClienteMobileOrder } from './entities/cliente-mobile-order.entity';
import { ClienteMobileOrderItem } from './entities/cliente-mobile-order-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClienteMobileOrder, ClienteMobileOrderItem]),
    TypeOrmModule.forFeature([ClienteMobileSession]),
    TypeOrmModule.forFeature([Cliente], 'legacy_db'),
    ClientesMobileModule,
    ClientesCreditoModule,
  ],
  controllers: [ClientesMobileOrdersController],
  providers: [ClientesMobileOrdersService],
  exports: [ClientesMobileOrdersService],
})
export class ClientesMobileOrdersModule {}
