import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ClienteMobileOrderStatus } from '../clientes-mobile-orders/entities/cliente-mobile-order.entity';
import { ClientesMobileOrdersBackofficeService } from './clientes-mobile-orders-backoffice.service';
import { ListClientesMobileOrdersBackofficeDto } from './dto/list-clientes-mobile-orders-backoffice.dto';
import { UpdateClientesMobileOrderStatusDto } from './dto/update-clientes-mobile-order-status.dto';

@ApiTags('Clientes Mobile Orders Backoffice')
@Controller('almacen/v1/clientes-mobile-orders-backoffice')
export class ClientesMobileOrdersBackofficeController {
  constructor(
    private readonly clientesMobileOrdersBackofficeService: ClientesMobileOrdersBackofficeService,
  ) {}

  @Get('orders')
  @ApiOperation({ summary: 'Lista pedidos mobile enviados para intranet/backoffice' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [ClienteMobileOrderStatus.SUBMITTED],
  })
  @ApiQuery({ name: 'customer', required: false, type: String, example: '07810' })
  @ApiQuery({ name: 'clienteId', required: false, type: Number, example: 35037 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  listSubmittedOrders(@Query() query: ListClientesMobileOrdersBackofficeDto) {
    return this.clientesMobileOrdersBackofficeService.listSubmittedOrders(query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Obtiene el detalle de un pedido mobile para intranet/backoffice' })
  getSubmittedOrderDetail(@Param('id', ParseIntPipe) id: number) {
    return this.clientesMobileOrdersBackofficeService.getSubmittedOrderDetail(id);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Actualiza el estatus de un pedido mobile y opcionalmente notifica al cliente' })
  updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateClientesMobileOrderStatusDto,
  ) {
    return this.clientesMobileOrdersBackofficeService.updateOrderStatus(id, body);
  }
}
