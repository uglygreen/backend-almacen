import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags, ApiBody } from '@nestjs/swagger';
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

  @Post('detalle-hora')
  @ApiOperation({ summary: 'Obtener pedidos y partidas de un usuario por hora' })
  @ApiQuery({ name: 'zona', enum: ['CC', 'AG'] })
  @ApiBody({ 
    schema: { 
      type: 'object', 
      properties: { 
        id: { type: 'number', example: 1000143 },
        horaInicio: { type: 'string', example: '12:00:00' },
        horaFinal: { type: 'string', example: '12:59:59' }
      }
    }
  })
  async getDetallePorHora(
    @Query('zona') zona: 'CC' | 'AG',
    @Body() payload: { id: number, horaInicio: string, horaFinal: string }
  ) {
    return this.metricasService.getDetallePedidosPorHora(payload.id, zona, payload.horaInicio, payload.horaFinal);
  }

  @Get('tiempos-muertos')
  @ApiOperation({ summary: 'Ver usuarios inactivos por más de 15 min' })
  async getTiemposMuertos() {
    return this.metricasService.getTiemposMuertos();
  }
}