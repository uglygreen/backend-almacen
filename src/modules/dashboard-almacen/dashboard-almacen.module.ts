import { Module } from '@nestjs/common';
import { AuthAlmacenModule } from '../auth-almacen/auth-almacen.module';
import { DashboardAlmacenController } from './dashboard-almacen.controller';
import { DashboardAlmacenService } from './dashboard-almacen.service';

@Module({
  imports: [AuthAlmacenModule],
  controllers: [DashboardAlmacenController],
  providers: [DashboardAlmacenService],
  exports: [DashboardAlmacenService],
})
export class DashboardAlmacenModule {}
