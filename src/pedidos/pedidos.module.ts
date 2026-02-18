import { Module } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { PedidosController } from './pedidos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DetallePedido, Pedido, Surtido } from 'src/entities';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([Pedido, DetallePedido, Surtido]), EventsModule],
  controllers: [PedidosController],
  providers: [PedidosService],
})
export class PedidosModule {}
