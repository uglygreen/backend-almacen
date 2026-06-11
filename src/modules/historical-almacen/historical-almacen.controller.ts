import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthAlmacenGuard } from '../auth-almacen/auth-almacen.guard';
import { GetHistoricalSummaryDto } from './dto/get-historical-summary.dto';
import { HistoricalAlmacenService } from './historical-almacen.service';

@ApiTags('Historical Almacen')
@Controller('almacen/v1/historical')
@UseGuards(AuthAlmacenGuard)
export class HistoricalAlmacenController {
  constructor(private readonly historicalAlmacenService: HistoricalAlmacenService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumen histórico por rango de fechas desde surtido' })
  getSummary(@Query() query: GetHistoricalSummaryDto) {
    return this.historicalAlmacenService.getSummary(query.fechaInicio, query.fechaFin);
  }
}
