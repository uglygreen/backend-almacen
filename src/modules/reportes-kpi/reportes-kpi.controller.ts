import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GetKpiVentasPorEstadoDto } from './dto/get-kpi-ventas-por-estado.dto';
import { ReportesKpiService } from './reportes-kpi.service';

@ApiTags('Reportes KPI')
@Controller('almacen/v1/reportes-kpi')
export class ReportesKpiController {
  constructor(private readonly reportesKpiService: ReportesKpiService) {}

  @Get('ventas-por-estado')
  @ApiOperation({
    summary: 'Obtiene el KPI de ventas por estado usando facturas legacy y domicilio fiscal',
  })
  @ApiQuery({ name: 'fechaInicio', required: false, type: String, example: '2026-01-01' })
  @ApiQuery({ name: 'fechaFin', required: false, type: String, example: '2026-07-23' })
  @ApiQuery({
    name: 'soloTimbradas',
    required: false,
    type: Boolean,
    example: false,
    description: "Cuando es true solo considera facturas con XML timbrado, TIPDOC='F' y CFDMETODOPAGO='PPD'.",
  })
  getVentasPorEstado(@Query() query: GetKpiVentasPorEstadoDto) {
    return this.reportesKpiService.getVentasPorEstado(query);
  }

  @Get('ventas-por-estado-mensual')
  @ApiOperation({
    summary: 'Obtiene el KPI de ventas por estado agrupado por mes usando facturas legacy',
  })
  @ApiQuery({ name: 'fechaInicio', required: false, type: String, example: '2026-01-01' })
  @ApiQuery({ name: 'fechaFin', required: false, type: String, example: '2026-07-23' })
  @ApiQuery({
    name: 'soloTimbradas',
    required: false,
    type: Boolean,
    example: false,
    description: 'Respeta el mismo criterio de getVentasPorEstado para CFD/XML.',
  })
  getVentasPorEstadoMensual(@Query() query: GetKpiVentasPorEstadoDto) {
    return this.reportesKpiService.getVentasPorEstadoMensual(query);
  }

  @Get('ventas-por-emisor')
  @ApiOperation({
    summary: 'Obtiene el KPI de ventas por emisor usando EMISORID y nombre desde PER',
  })
  @ApiQuery({ name: 'fechaInicio', required: false, type: String, example: '2026-01-01' })
  @ApiQuery({ name: 'fechaFin', required: false, type: String, example: '2026-07-23' })
  @ApiQuery({
    name: 'soloTimbradas',
    required: false,
    type: Boolean,
    example: false,
    description: 'Respeta el mismo criterio de getVentasPorEstado para CFD/XML.',
  })
  getVentasPorEmisor(@Query() query: GetKpiVentasPorEstadoDto) {
    return this.reportesKpiService.getVentasPorEmisor(query);
  }
}
