import { Module } from '@nestjs/common';
import { ReportesKpiController } from './reportes-kpi.controller';
import { ReportesKpiService } from './reportes-kpi.service';

@Module({
  controllers: [ReportesKpiController],
  providers: [ReportesKpiService],
})
export class ReportesKpiModule {}
