import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MetricasService } from './metricas.service';

@ApiTags('Métricas')
@Controller('metricas')
export class MetricasController {
  constructor(private metricasService: MetricasService) {}

  @Get('ranking')
  @ApiOperation({ summary: 'Obtener tabla de posiciones de almacenistas' })
  @ApiQuery({ name: 'zona', enum: ['CC', 'AG'] })
  @ApiQuery({ name: 'periodo', enum: ['dia', 'semana', 'mes'] })
  async getRanking(
    @Query('zona') zona: 'CC' | 'AG',
    @Query('periodo') periodo: 'dia' | 'semana' | 'mes'
  ): Promise<any> {
    return this.metricasService.getRankingAlmacenistas(zona, periodo);
  }

  @Get('tiempos-muertos')
  @ApiOperation({ summary: 'Ver usuarios inactivos por más de 15 min' })
  async getTiemposMuertos() {
    return this.metricasService.getTiemposMuertos();
  }
}