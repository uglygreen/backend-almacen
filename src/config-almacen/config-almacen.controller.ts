import { Body, Controller, Get, Post } from '@nestjs/common';
import { ConfigAlmacenService } from './config-almacen.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Configuración Almacén')
@Controller('config-almacen')
export class ConfigAlmacenController {
  constructor(private readonly configService: ConfigAlmacenService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener la configuración actual de fechas' })
  obtenerConfiguracion() {
    return this.configService.obtenerConfiguracion();
  }

  @Post('rango')
  @ApiOperation({ summary: 'Establecer un rango de fechas personalizado' })
  actualizarRango(@Body() body: { fechaMin: string; fechaMax: string }) {
    return this.configService.actualizarConfiguracion(body.fechaMin, body.fechaMax);
  }

  @Post('hoy')
  @ApiOperation({ summary: 'Establecer fechas para el día de HOY' })
  setHoy() {
    return this.configService.setHoy();
  }

  @Post('dos-dias')
  @ApiOperation({ summary: 'Establecer fechas para HOY y AYER' })
  setDosDias() {
    return this.configService.setDosDias();
  }
}
