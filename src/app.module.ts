import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { PedidosModule } from './pedidos/pedidos.module';
import { SincronizacionModule } from './sincronizacion/sincronizacion.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlmLegacy, AlmacenUser, AlmacenUserBaseConfig, ClienteCreditoExcepcion, ClienteMobileOtp, ClienteMobileSession, ControlSincronizacion, CorreoLegacy, CustomerNotification, DesLegacy, DetallePedido, DeviceToken, DocLegacy, DomLegacy, InvLegacy, NomAlmLegacy, PagDocLegacy, Pedido, Producto, ProductoCodigo, Surtido, UnidadLegacy } from './entities';
import { MetricasModule } from './metricas/metricas.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { InventarioModule } from './inventario/inventario.module';
import { ClientesModule } from './clientes/clientes.module';
import { Cliente } from './entities/cliente.entity';
import { ConfigAlmacenModule } from './config-almacen/config-almacen.module';
import { ConfigAlmacen } from './entities/config-almacen.entity';

import { GarantiasModule } from './garantias/garantias.module';
import { Garantia, HistorialEstatusGarantia, MediaGarantia } from './entities/garantia.entity';
import { EventsModule } from './events/events.module';
import { Personal } from './entities/personal.entity';
import { PersonalModule } from './personal/personal.module';
import { AsistenciaModule } from './asistencia/asistencia.module';
import { IclockTransaction } from './asistencia/entities/iclock-transaction.entity';
import { PersonnelEmployee } from './asistencia/entities/personnel-employee.entity';
import { PersonnelPosition } from './asistencia/entities/personnel-position.entity';
import { PersonnelDepartment } from './asistencia/entities/personnel-department.entity';

import { AuthAlmacenModule } from './modules/auth-almacen/auth-almacen.module';
import { UsersAlmacenModule } from './modules/users-almacen/users-almacen.module';
import { OrdersAlmacenModule } from './modules/orders-almacen/orders-almacen.module';
import { CapturaAlmacenModule } from './modules/captura-almacen/captura-almacen.module';
import { DashboardAlmacenModule } from './modules/dashboard-almacen/dashboard-almacen.module';
import { ReportsAlmacenModule } from './modules/reports-almacen/reports-almacen.module';
import { RealtimeAlmacenModule } from './modules/realtime-almacen/realtime-almacen.module';
import { AuditAlmacenModule } from './modules/audit-almacen/audit-almacen.module';
import { AuditEvent } from './modules/audit-almacen/entities/audit-event.entity';
import { HistoricalAlmacenModule } from './modules/historical-almacen/historical-almacen.module';
import { ClientesCreditoModule } from './modules/clientes-credito/clientes-credito.module';
import { ClientesMobileModule } from './modules/clientes-mobile/clientes-mobile.module';
import { ClientesMobileOrdersModule } from './modules/clientes-mobile-orders/clientes-mobile-orders.module';
import { ClientesMobileOrdersBackofficeModule } from './modules/clientes-mobile-orders-backoffice/clientes-mobile-orders-backoffice.module';
import { ClienteMobileOrder } from './modules/clientes-mobile-orders/entities/cliente-mobile-order.entity';
import { ClienteMobileOrderItem } from './modules/clientes-mobile-orders/entities/cliente-mobile-order-item.entity';
import { PersonalBaseAlmacenModule } from './modules/personal-base-almacen/personal-base-almacen.module';
import { ThermalLabelsAlmacenModule } from './modules/thermal-labels-almacen/thermal-labels-almacen.module';
import { CustomerNotificationsModule } from './modules/customer-notifications/customer-notifications.module';
import { envNumber, envString } from './config/runtime-env';

function requiredEnv(key: string) {
  const value = envString(key).trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

@Module({
  imports: [
    // 1. Activar Cron Jobs
    ScheduleModule.forRoot(),
    
    // 1.5 Servir archivos estáticos
    ServeStaticModule.forRoot({
      rootPath: envString('UPLOADS_ROOT', join(process.cwd(), 'uploads')),
      serveRoot: '/uploads', 
    }),

    // 2. Conexión Principal (Escritura - Sistemas)
    TypeOrmModule.forRoot({
      name: 'default', // Nombre por defecto
      type: 'mysql',
      host: requiredEnv('DB_HOST'),
      port: envNumber('DB_PORT', 3306),
      username: requiredEnv('DB_USER'),
      password: requiredEnv('DB_PASSWORD'),
      database: requiredEnv('DB_NAME'),
      entities: [Pedido, DetallePedido, Producto, AlmacenUser, AlmacenUserBaseConfig, ControlSincronizacion, ProductoCodigo, Surtido, ConfigAlmacen, Garantia, HistorialEstatusGarantia, MediaGarantia, AuditEvent, ClienteCreditoExcepcion, ClienteMobileOtp, ClienteMobileSession, ClienteMobileOrder, ClienteMobileOrderItem, DeviceToken, CustomerNotification],
      synchronize: false, // ¡Cuidado en producción!
    }),

    // 3. Conexión Secundaria (Solo Lectura - Legacy)
    TypeOrmModule.forRoot({
      name: 'legacy_db', // Nombre para inyectar después
      type: 'mysql', // O la base que sea DatosB (ej. mssql, oracle)
      host: envString('LEGACY_DB_HOST', requiredEnv('DB_HOST')),
      port: envNumber('LEGACY_DB_PORT', envNumber('DB_PORT', 3306)),
      username: envString('LEGACY_DB_USER', requiredEnv('DB_USER')),
      password: envString('LEGACY_DB_PASSWORD', requiredEnv('DB_PASSWORD')),
      database: requiredEnv('LEGACY_DB_NAME'),
      entities: [Cliente, Personal, DocLegacy, PagDocLegacy, DomLegacy, InvLegacy, DesLegacy, AlmLegacy, NomAlmLegacy, CorreoLegacy, UnidadLegacy],
      synchronize: false,
    }),

    // 4. Conexión ZKTeco (PostgreSQL) - Base Principal
    TypeOrmModule.forRoot({
      name: 'zkteco_db',
      type: 'postgres',
      host: requiredEnv('ZKTECO_DB_HOST'),
      port: envNumber('ZKTECO_DB_PORT', 7496),
      username: requiredEnv('ZKTECO_DB_USER'),
      password: requiredEnv('ZKTECO_DB_PASSWORD'),
      database: requiredEnv('ZKTECO_DB_NAME'),
      entities: [IclockTransaction, PersonnelEmployee, PersonnelPosition, PersonnelDepartment],
      synchronize: false, // La base de datos ya existe, no sincronizar
    }),

    // 4.1 Conexión ZKTeco (PostgreSQL) - Sucursal Tequisquiapan (IP Dinámica)
    // Se registra para poder inyectar repositorios, pero no se inicializa al arrancar.
    // El host real se obtiene dinámicamente en AsistenciaService cuando se consulta Tequisquiapan.
    TypeOrmModule.forRoot({
      name: 'zkteco_tequis_db',
      type: 'postgres',
      host: requiredEnv('ZKTECO_TEQUIS_DB_HOST'),
      port: envNumber('ZKTECO_TEQUIS_DB_PORT', 7496),
      username: requiredEnv('ZKTECO_TEQUIS_DB_USER'),
      password: requiredEnv('ZKTECO_TEQUIS_DB_PASSWORD'),
      database: requiredEnv('ZKTECO_TEQUIS_DB_NAME'),
      entities: [IclockTransaction, PersonnelEmployee, PersonnelPosition, PersonnelDepartment],
      synchronize: false,
    }),

    // 5. Módulos de Funcionalidad
    PedidosModule,
    SincronizacionModule,
    MetricasModule,
    UsuariosModule,
    InventarioModule,
    ClientesModule,
    PersonalModule,
    ConfigAlmacenModule,
    GarantiasModule,
    EventsModule,
    AsistenciaModule,
    AuthAlmacenModule,
    UsersAlmacenModule,
    OrdersAlmacenModule,
    CapturaAlmacenModule,
    DashboardAlmacenModule,
    ReportsAlmacenModule,
    RealtimeAlmacenModule,
    AuditAlmacenModule,
    HistoricalAlmacenModule,
    ClientesCreditoModule,
    ClientesMobileModule,
    ClientesMobileOrdersModule,
    ClientesMobileOrdersBackofficeModule,
    PersonalBaseAlmacenModule,
    ThermalLabelsAlmacenModule,
    CustomerNotificationsModule,
  ],
  controllers: [ ],
  providers: [],
})
export class AppModule {}
