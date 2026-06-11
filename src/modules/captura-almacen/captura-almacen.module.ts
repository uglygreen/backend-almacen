import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Surtido } from '../../entities';
import { AuditAlmacenModule } from '../audit-almacen/audit-almacen.module';
import { AuthAlmacenModule } from '../auth-almacen/auth-almacen.module';
import { OrdersAlmacenModule } from '../orders-almacen/orders-almacen.module';
import { RealtimeAlmacenModule } from '../realtime-almacen/realtime-almacen.module';
import { CapturaAlmacenController } from './captura-almacen.controller';
import { CapturaAlmacenService } from './captura-almacen.service';

@Module({
  imports: [TypeOrmModule.forFeature([Surtido]), OrdersAlmacenModule, RealtimeAlmacenModule, AuditAlmacenModule, AuthAlmacenModule],
  controllers: [CapturaAlmacenController],
  providers: [CapturaAlmacenService],
})
export class CapturaAlmacenModule {}
