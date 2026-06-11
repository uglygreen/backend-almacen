import { Module } from '@nestjs/common';
import { AuthAlmacenModule } from '../auth-almacen/auth-almacen.module';
import { DashboardAlmacenModule } from '../dashboard-almacen/dashboard-almacen.module';
import { ReportsAlmacenController } from './reports-almacen.controller';
import { ReportsAlmacenService } from './reports-almacen.service';

@Module({
  imports: [DashboardAlmacenModule, AuthAlmacenModule],
  controllers: [ReportsAlmacenController],
  providers: [ReportsAlmacenService],
})
export class ReportsAlmacenModule {}
