import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlmacenUser, Surtido } from '../../entities';
import { ConfigAlmacen } from '../../entities/config-almacen.entity';
import { AuthAlmacenModule } from '../auth-almacen/auth-almacen.module';
import { OrdersAlmacenController } from './orders-almacen.controller';
import { OrdersAlmacenService } from './orders-almacen.service';

@Module({
  imports: [TypeOrmModule.forFeature([AlmacenUser, Surtido, ConfigAlmacen]), AuthAlmacenModule],
  controllers: [OrdersAlmacenController],
  providers: [OrdersAlmacenService],
  exports: [OrdersAlmacenService],
})
export class OrdersAlmacenModule {}
