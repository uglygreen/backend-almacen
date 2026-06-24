import { Module } from '@nestjs/common';
import { SincronizacionService } from './sincronizacion.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ControlSincronizacion, DetallePedido, Pedido, Producto, ProductoCodigo } from 'src/entities';
import { EventsModule } from '../events/events.module';
import { ClientesMobileOrdersModule } from '../modules/clientes-mobile-orders/clientes-mobile-orders.module';

@Module({
  imports: [
    // Importamos las entidades donde guardaremos los datos
    TypeOrmModule.forFeature([
      ControlSincronizacion, 
      Producto, 
      Pedido, 
      DetallePedido,
      ProductoCodigo 
    ]),
    EventsModule,
    ClientesMobileOrdersModule,
  ],
  providers: [SincronizacionService],
})
export class SincronizacionModule {}
