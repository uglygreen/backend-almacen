import { Module } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { PedidosController } from './pedidos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DetallePedido, Pedido } from 'src/entities';
import { EventsGateway } from 'src/events/events.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Pedido, DetallePedido])],
  controllers: [PedidosController],
  providers: [PedidosService, EventsGateway ],
})
export class PedidosModule {}
