import { Module } from '@nestjs/common';

import { PedidosModule } from './pedidos/pedidos.module';
import { SincronizacionModule } from './sincronizacion/sincronizacion.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlmacenUser, ControlSincronizacion, DetallePedido, Pedido, Producto, ProductoCodigo } from './entities';
import { EventsGateway } from './events/events.gateway';
import { MetricasModule } from './metricas/metricas.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { InventarioModule } from './inventario/inventario.module';

@Module({
  imports: [
    // 1. Activar Cron Jobs
    ScheduleModule.forRoot(),

    // 2. Conexión Principal (Escritura - Sistemas)
    TypeOrmModule.forRoot({
      name: 'default', // Nombre por defecto
      type: 'mysql',
      host: '192.168.1.250',
      port: 3306,
      username: 'web',
      password: 'webfmolvera17',
      database: 'sistemas',
      entities: [Pedido, DetallePedido, Producto, AlmacenUser, ControlSincronizacion, ProductoCodigo],
      synchronize: false, // ¡Cuidado en producción!
    }),

    // 3. Conexión Secundaria (Solo Lectura - Legacy)
    TypeOrmModule.forRoot({
      name: 'legacy_db', // Nombre para inyectar después
      type: 'mysql', // O la base que sea DatosB (ej. mssql, oracle)
      host: '192.168.1.250',
      port: 3306,
      username: 'web',
      password: 'webfmolvera17',
      database: 'datosb',
      entities: [], // No necesitamos entidades aquí, usaremos Raw Queries
      synchronize: false,
    }),

    // 4. Módulos de Funcionalidad
    PedidosModule,
    SincronizacionModule,
    MetricasModule,
    UsuariosModule,
    InventarioModule,
  ],
  controllers: [ ],
  providers: [ EventsGateway],
})
export class AppModule {}
