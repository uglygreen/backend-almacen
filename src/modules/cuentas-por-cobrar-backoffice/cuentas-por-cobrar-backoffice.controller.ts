import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ListCuentasPorCobrarComplementosDto } from './dto/list-cuentas-por-cobrar-complementos.dto';
import { SearchCuentasPorCobrarClientesDto } from './dto/search-cuentas-por-cobrar-clientes.dto';
import { CuentasPorCobrarBackofficeService } from './cuentas-por-cobrar-backoffice.service';

@ApiTags('Cuentas por Cobrar Backoffice')
@Controller('almacen/v1/cuentas-por-cobrar')
export class CuentasPorCobrarBackofficeController {
  constructor(
    private readonly cuentasPorCobrarBackofficeService: CuentasPorCobrarBackofficeService,
  ) {}

  @Get('clientes/search')
  @ApiOperation({ summary: 'Busca clientes por nombre y/o numero para cuentas por cobrar' })
  @ApiQuery({ name: 'search', required: false, type: String, example: '19043' })
  @ApiQuery({ name: 'nombre', required: false, type: String, example: 'MARIA GABRIELA' })
  @ApiQuery({ name: 'numero', required: false, type: String, example: '19043' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  searchClientes(@Query() query: SearchCuentasPorCobrarClientesDto) {
    return this.cuentasPorCobrarBackofficeService.searchClientes(query);
  }

  @Get('complementos')
  @ApiOperation({ summary: 'Consulta complementos de pago por rango de fecha y cliente' })
  @ApiQuery({ name: 'from', required: true, type: String, example: '2026-07-01' })
  @ApiQuery({ name: 'to', required: true, type: String, example: '2026-07-31' })
  @ApiQuery({ name: 'clienteId', required: false, type: Number, example: 2421 })
  @ApiQuery({ name: 'numeroCliente', required: false, type: String, example: '19043' })
  listComplementos(@Query() query: ListCuentasPorCobrarComplementosDto) {
    return this.cuentasPorCobrarBackofficeService.listComplementos(query);
  }
}
