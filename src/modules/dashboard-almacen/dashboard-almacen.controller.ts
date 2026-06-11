import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthAlmacenGuard } from '../auth-almacen/auth-almacen.guard';
import { DashboardAlmacenService } from './dashboard-almacen.service';
import { GetDashboardSummaryDto } from './dto/get-dashboard-summary.dto';

@ApiTags('Dashboard Almacen')
@Controller('almacen/v1/dashboard')
@UseGuards(AuthAlmacenGuard)
export class DashboardAlmacenController {
  constructor(private readonly dashboardAlmacenService: DashboardAlmacenService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumen consolidado del dashboard de almacén' })
  getSummary(@Query() query: GetDashboardSummaryDto) {
    return this.dashboardAlmacenService.getSummary(query.date);
  }

  @Get('operators')
  @ApiOperation({ summary: 'Listado de operadores con métricas del día' })
  getOperators(@Query() query: GetDashboardSummaryDto) {
    return this.dashboardAlmacenService.getOperators(query.date);
  }

  @Get('operators/:id/timeslots')
  @ApiOperation({ summary: 'Métricas por franja para un operador' })
  getOperatorTimeslots(@Param('id', ParseIntPipe) id: number, @Query() query: GetDashboardSummaryDto) {
    return this.dashboardAlmacenService.getOperatorTimeslots(id, query.date);
  }

  @Get('operators/:id/last')
  @ApiOperation({ summary: 'Último surtido del operador' })
  getOperatorLast(@Param('id', ParseIntPipe) id: number, @Query() query: GetDashboardSummaryDto) {
    return this.dashboardAlmacenService.getOperatorLast(id, query.date);
  }

  @Get('operators/:id/weekly-report')
  @ApiOperation({ summary: 'Reporte semanal con comisión del operador' })
  getWeeklyReport(@Param('id', ParseIntPipe) id: number) {
    return this.dashboardAlmacenService.getWeeklyReport(id);
  }

  @Get('operators/:id/orders-detail')
  @ApiOperation({ summary: 'Detalle de pedidos por rango horario' })
  @ApiQuery({ name: 'date', type: String, example: '2026-04-27' })
  @ApiQuery({ name: 'from', type: String, example: '07:00:00' })
  @ApiQuery({ name: 'to', type: String, example: '10:59:59' })
  getOrdersDetail(
    @Param('id', ParseIntPipe) id: number,
    @Query('date') date: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.dashboardAlmacenService.getOrdersDetail(id, date, from, to);
  }
}
