import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Inventario') // Etiqueta para Swagger
@Controller('inventario')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Get(':articuloid')
  @ApiOperation({ summary: 'Obtener existencia y ultima compra de un artículo por ID' })
  async obtenerInfoArticulo(@Param('articuloid', ParseIntPipe) articuloid: number) {
    return this.inventarioService.obtenerInfoArticulo(articuloid);
  }
}
