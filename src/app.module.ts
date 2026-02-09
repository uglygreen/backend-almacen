import { Module } from '@nestjs/common';

import { PedidosModule } from './pedidos/pedidos.module';
import { SincronizacionModule } from './sincronizacion/sincronizacion.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlmacenUser, ControlSincronizacion, DetallePedido, Pedido, Producto, ProductoCodigo, Surtido } from './entities';
import { EventsGateway } from './events/events.gateway';
import { MetricasModule } from './metricas/metricas.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { InventarioModule } from './inventario/inventario.module';
import { ClientesModule } from './clientes/clientes.module';
import { Cliente } from './entities/cliente.entity';
import { ConfigAlmacenModule } from './config-almacen/config-almacen.module';
import { ConfigAlmacen } from './entities/config-almacen.entity';

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
      entities: [Pedido, DetallePedido, Producto, AlmacenUser, ControlSincronizacion, ProductoCodigo, Surtido, ConfigAlmacen],
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
      entities: [Cliente], // Registramos la entidad Cliente
      synchronize: false,
    }),

    // 4. Módulos de Funcionalidad
    PedidosModule,
    SincronizacionModule,
    MetricasModule,
    UsuariosModule,
    InventarioModule,
    ClientesModule,
    ConfigAlmacenModule,
  ],
  controllers: [ ],
  providers: [ EventsGateway],
})
export class AppModule {}
