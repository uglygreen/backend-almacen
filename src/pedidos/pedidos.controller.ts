import { Controller, Get, Post, Body, Patch, Param, Res } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { ActualizarLineaDto, AsignarPedidoDto, AsignarSiguienteDto, EmpaquetarPedidoDto, FinalizarEtapaDto } from './dto/pedidos.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

@ApiTags('Pedidos') // Etiqueta para Swagger
@Controller('pedidos')
export class PedidosController {
  constructor(
    private readonly pedidosService: PedidosService
  ) {}

  // -----------------------------------------------------
  // 1. CONSULTAS (GET)
  // -----------------------------------------------------

  @Get('cuarto-chico')
  @ApiOperation({ summary: 'Obtener lista de espera para Cuarto Chico' })
  async getPedidosCC() {
    return this.pedidosService.getPedidosCC();
  }

  @Get('almacen-general')
  @ApiOperation({ summary: 'Obtener lista de espera para Almacén General' })
  async getPedidosAG() {
    return this.pedidosService.getPedidosAG();
  }

  @Get('en-surtido')
  @ApiOperation({ summary: 'Obtener pedidos que se están surtiendo actualmente' })
  async getPedidosEnSurtido() {
    return this.pedidosService.getPedidosEnSurtido();
  }

  @Get('completados-hoy')
  @ApiOperation({ summary: 'Obtener pedidos completados en el día actual' })
  async getPedidosCompletadosHoy() {
    return this.pedidosService.getPedidosCompletadosHoy();
  }

  @Get(':id/detalle')
  @ApiOperation({ summary: 'Ver productos de un pedido específico' })
  async getDetalle(@Param('id') id: number) {
    return this.pedidosService.getDetalle(id);
  }

  // -----------------------------------------------------
  // 2. OPERACIONES (PATCH / POST)
  // -----------------------------------------------------
  @Patch(':id/asignar')
  @ApiOperation({ summary: 'Asignar un pedido a un usuario (CC o AG)' })
  async asignarUsuario(
    @Param('id') id: number,
    @Body() dto: AsignarPedidoDto // Validado automáticamente
  ) {
    return this.pedidosService.asignarUsuario(id, dto);
  }

  @Post('asignar-siguiente')
  @ApiOperation({ summary: 'Asigna el pedido más antiguo disponible a un usuario' })
  async asignarSiguienteDisponible(
    @Body() dto: AsignarSiguienteDto
  ) {
    return this.pedidosService.asignarSiguienteDisponible(dto);
  }

  @Patch('linea/:id')
  @ApiOperation({ summary: 'Actualizar cantidad surtida de un producto' })
  async actualizarLinea(
    @Param('id') id: number,
    @Body() dto: ActualizarLineaDto
  ) {
      return this.pedidosService.actualizarLinea(id, dto);
  }

  @Post(':id/finalizar-etapa')
  @ApiOperation({ summary: 'Terminar surtido en una zona y pasar a la siguiente' })
  async finalizarEtapa(
    @Param('id') id: number,
    @Body() dto: FinalizarEtapaDto
  ) {
    return this.pedidosService.finalizarEtapa(id, dto);
    
  }

  @Post(':id/empaquetar')
  @ApiOperation({ summary: 'Marcar un pedido como empaquetado y generar tickets en PDF' })
  async marcarComoEmpaquetado(
    @Param('id') id: number,
    @Body() dto: EmpaquetarPedidoDto,
    @Res() res: Response
  ) {
    const pdfBuffer = await this.pedidosService.marcarComoEmpaquetadoYGenerarTickets(id, dto);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=tickets-pedido-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}