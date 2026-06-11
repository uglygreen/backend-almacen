import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthAlmacenGuard } from '../auth-almacen/auth-almacen.guard';
import { ReportsAlmacenService } from './reports-almacen.service';

// @UseGuards(AuthAlmacenGuard)
@ApiTags('Reports Almacen')
@Controller('almacen/v1/reports')
export class ReportsAlmacenController {
  constructor(private readonly reportsAlmacenService: ReportsAlmacenService) {}

  @Get('top-performers')
  @ApiOperation({ summary: 'Ranking de mejores almacenistas por rango' })
  @ApiQuery({ name: 'range', required: false, enum: ['today', 'current-week'] })
  @ApiQuery({ name: 'startDate', required: false, type: String, example: '2026-05-15' })
  @ApiQuery({ name: 'endDate', required: false, type: String, example: '2026-05-21' })
  getTopPerformers(
    @Query('range') range?: 'today' | 'current-week',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsAlmacenService.getTopPerformers(range ?? 'current-week', startDate, endDate);
  }

  @Get('operators/:id/weekly-report')
  @ApiOperation({ summary: 'Reporte semanal y comisión de un almacenista' })
  getWeeklyReport(@Param('id', ParseIntPipe) id: number) {
    return this.reportsAlmacenService.getWeeklyReport(id);
  }

  @Get('warehouse-hourly-report')
  @ApiOperation({ summary: 'Reporte de pedidos registrados por hora en almacen' })
  @ApiQuery({ name: 'range', required: false, enum: ['today', 'current-week'] })
  @ApiQuery({ name: 'startDate', required: false, type: String, example: '2026-05-15' })
  @ApiQuery({ name: 'endDate', required: false, type: String, example: '2026-05-21' })
  getWarehouseHourlyReport(
    @Query('range') range?: 'today' | 'current-week',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsAlmacenService.getWarehouseHourlyReport(range ?? 'current-week', startDate, endDate);
  }

  @Get('user-audit-report')
  @ApiOperation({ summary: 'Reporte detallado de registros por almacenista para auditoria' })
  @ApiQuery({ name: 'range', required: false, enum: ['today', 'current-week'] })
  @ApiQuery({ name: 'startDate', required: false, type: String, example: '2026-05-15' })
  @ApiQuery({ name: 'endDate', required: false, type: String, example: '2026-05-21' })
  @ApiQuery({ name: 'userIds', required: false, type: String, example: '1,2,3' })
  getUserAuditReport(
    @Query('range') range?: 'today' | 'current-week',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userIds') userIds?: string,
  ) {
    return this.reportsAlmacenService.getUserAuditReport(range ?? 'current-week', startDate, endDate, userIds);
  }

  @Get('operators/:id/orders-detail')
  @ApiOperation({ summary: 'Detalle de pedidos por rango horario para reportes' })
  @ApiQuery({ name: 'date', type: String, example: '2026-04-27' })
  @ApiQuery({ name: 'from', type: String, example: '07:00:00' })
  @ApiQuery({ name: 'to', type: String, example: '10:59:59' })
  getOrdersDetail(
    @Param('id', ParseIntPipe) id: number,
    @Query('date') date: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsAlmacenService.getOrdersDetail(id, date, from, to);
  }
}
