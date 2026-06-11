import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthAlmacenGuard } from '../auth-almacen/auth-almacen.guard';
import { CreateClienteCreditoExcepcionDto } from './dto/create-cliente-credito-excepcion.dto';
import { ListClienteCreditoExcepcionesDto } from './dto/list-cliente-credito-excepciones.dto';
import { UpdateClienteCreditoExcepcionDto } from './dto/update-cliente-credito-excepcion.dto';
import { ClientesCreditoService } from './clientes-credito.service';

@ApiTags('Clientes Credito')
@Controller('almacen/v1/clientes-credito')
export class ClientesCreditoController {
  constructor(private readonly clientesCreditoService: ClientesCreditoService) {}

  @Get('excepciones')
  @ApiOperation({ summary: 'Listar excepciones de crédito de clientes' })
  @ApiQuery({ name: 'clienteId', required: false, type: Number })
  @ApiQuery({ name: 'numeroCliente', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listExcepciones(@Query() query: ListClienteCreditoExcepcionesDto) {
    return this.clientesCreditoService.listExcepciones(query);
  }

  @Get('excepciones/:excepcionId')
  @ApiOperation({ summary: 'Obtener una excepción de crédito por ID' })
  getExcepcion(@Param('excepcionId', ParseIntPipe) excepcionId: number) {
    return this.clientesCreditoService.getExcepcion(excepcionId);
  }

  @Post('excepciones')
  @ApiOperation({ summary: 'Crear una excepción de crédito para cliente' })
  createExcepcion(@Body() body: CreateClienteCreditoExcepcionDto) {
    return this.clientesCreditoService.createExcepcion(body);
  }

  @Patch('excepciones/:excepcionId')
  @ApiOperation({ summary: 'Actualizar una excepción de crédito' })
  updateExcepcion(
    @Param('excepcionId', ParseIntPipe) excepcionId: number,
    @Body() body: UpdateClienteCreditoExcepcionDto,
  ) {
    return this.clientesCreditoService.updateExcepcion(excepcionId, body);
  }

  @Delete('excepciones/:excepcionId')
  @ApiOperation({ summary: 'Eliminar una excepción de crédito' })
  deleteExcepcion(@Param('excepcionId', ParseIntPipe) excepcionId: number) {
    return this.clientesCreditoService.deleteExcepcion(excepcionId);
  }

  @Get(':id/resumen')
  @ApiOperation({ summary: 'Obtener resumen de crédito y morosidad del cliente' })
  @ApiParam({ name: 'id', type: Number, example: 12345 })
  getResumen(@Param('id', ParseIntPipe) id: number) {
    return this.clientesCreditoService.getResumenCliente(id);
  }
}
