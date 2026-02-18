import { Module } from '@nestjs/common';
import { SincronizacionService } from './sincronizacion.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ControlSincronizacion, DetallePedido, Pedido, Producto, ProductoCodigo } from 'src/entities';
import { EventsModule } from '../events/events.module';

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
    EventsModule
  ],
  providers: [SincronizacionService],
})
export class SincronizacionModule {}
