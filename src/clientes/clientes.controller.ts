import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Clientes (Legacy)')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener lista de clientes paginada' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 100,
  ) {
    return this.clientesService.findAll(Number(page), Number(limit));
  }

  @Get('activos')
  @ApiOperation({ summary: 'Obtener clientes activos' })
  findActivos() {
    return this.clientesService.findActivos();
  }

  @Get('deudores')
  @ApiOperation({ summary: 'Obtener clientes con saldo pendiente' })
  findDeudores() {
    return this.clientesService.findDeudores();
  }

  @Get('buscar-por-numero/:numero')
  @ApiOperation({ summary: 'Obtener cliente por numero de cliente' })
  findOneByNumber(@Param('numero') numero: string) {
    return this.clientesService.findOneByNumber(numero);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cliente por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.findOne(id);
  }
}
