import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ClientesMobileAuthGuard } from '../clientes-mobile/clientes-mobile-auth.guard';
import { AddClientesMobileOrderItemDto } from './dto/add-clientes-mobile-order-item.dto';
import { CreateClientesMobileOrderDraftDto } from './dto/create-clientes-mobile-order-draft.dto';
import { GetCfdiOptionsDto } from './dto/get-cfdi-options.dto';
import { ListClientesMobileOrdersDto } from './dto/list-clientes-mobile-order-drafts.dto';
import { SubmitClientesMobileOrdersDto } from './dto/submit-clientes-mobile-orders.dto';
import { UpdateClientesMobileOrderDraftDto } from './dto/update-clientes-mobile-order-draft.dto';
import { UpdateClientesMobileOrderItemDto } from './dto/update-clientes-mobile-order-item.dto';
import { ClientesMobileOrdersService } from './clientes-mobile-orders.service';
import { ClienteMobileOrderStatus } from './entities/cliente-mobile-order.entity';

@ApiTags('Clientes Mobile Orders')
@Controller('clientes-mobile/v1')
@UseGuards(ClientesMobileAuthGuard)
export class ClientesMobileOrdersController {
  constructor(private readonly clientesMobileOrdersService: ClientesMobileOrdersService) {}

  @Get('orders')
  @ApiOperation({ summary: 'Lista los pedidos del cliente autenticado por estatus' })
  @ApiQuery({ name: 'customer', required: false, type: String, example: '07810' })
  @ApiQuery({ name: 'status', required: false, enum: [ClienteMobileOrderStatus.DRAFT, ClienteMobileOrderStatus.SUBMITTED] })
  listOrders(@Req() req: any, @Query() query: ListClientesMobileOrdersDto) {
    return this.clientesMobileOrdersService.listOrders(
      req.user.sub,
      req.user.numeroCliente,
      query,
    );
  }

  @Get('orders/drafts')
  @ApiOperation({ summary: 'Lista los pedidos draft del cliente autenticado' })
  @ApiQuery({ name: 'customer', required: false, type: String, example: '07810' })
  listDrafts(@Req() req: any, @Query() query: ListClientesMobileOrdersDto) {
    return this.clientesMobileOrdersService.listOrders(
      req.user.sub,
      req.user.numeroCliente,
      {
        ...query,
        status: ClienteMobileOrderStatus.DRAFT,
      },
    );
  }

  @Post('orders/drafts')
  @ApiOperation({ summary: 'Crea un draft de pedido para el cliente autenticado' })
  createDraft(@Req() req: any, @Body() body: CreateClientesMobileOrderDraftDto) {
    return this.clientesMobileOrdersService.createDraft(
      req.user.sub,
      req.user.numeroCliente,
      body,
    );
  }

  @Get('orders/drafts/:id')
  @ApiOperation({ summary: 'Obtiene el detalle de un draft de pedido' })
  getDraft(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.clientesMobileOrdersService.getDraft(req.user.sub, id);
  }

  @Patch('orders/drafts/:id')
  @ApiOperation({ summary: 'Actualiza direccion, CFDI o tipo de entrega del draft' })
  updateDraft(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateClientesMobileOrderDraftDto,
  ) {
    return this.clientesMobileOrdersService.updateDraft(req.user.sub, id, body);
  }

  @Delete('orders/drafts/:id')
  @ApiOperation({ summary: 'Elimina un pedido en estado draft y sus items' })
  deleteDraft(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.clientesMobileOrdersService.deleteDraft(req.user.sub, id);
  }

  @Post('orders/drafts/:id/items')
  @ApiOperation({ summary: 'Agrega un producto al draft de pedido' })
  addItem(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AddClientesMobileOrderItemDto,
  ) {
    return this.clientesMobileOrdersService.addItem(req.user.sub, id, body);
  }

  @Patch('orders/drafts/:id/items/:itemId')
  @ApiOperation({ summary: 'Actualiza la cantidad de un item del draft' })
  updateItem(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: UpdateClientesMobileOrderItemDto,
  ) {
    return this.clientesMobileOrdersService.updateItem(req.user.sub, id, itemId, body);
  }

  @Delete('orders/drafts/:id/items/:itemId')
  @ApiOperation({ summary: 'Elimina un producto del draft' })
  removeItem(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.clientesMobileOrdersService.removeItem(req.user.sub, id, itemId);
  }

  @Post('orders/submit')
  @ApiOperation({ summary: 'Envía uno o varios drafts seleccionados por el cliente' })
  submitOrders(@Req() req: any, @Body() body: SubmitClientesMobileOrdersDto) {
    return this.clientesMobileOrdersService.submitOrders(req.user.sub, body);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Obtiene el detalle final de un pedido del cliente' })
  getOrder(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.clientesMobileOrdersService.getOrder(req.user.sub, id);
  }

  @Get('customers/me/addresses')
  @ApiOperation({ summary: 'Lista las direcciones disponibles del cliente autenticado' })
  getAddresses(@Req() req: any) {
    return this.clientesMobileOrdersService.getAddresses(req.user.sub);
  }

  @Get('cfdi/options')
  @ApiOperation({ summary: 'Obtiene las opciones de uso CFDI disponibles para un RFC' })
  getCfdiOptions(@Query() query: GetCfdiOptionsDto) {
    return this.clientesMobileOrdersService.getCfdiOptions(query.rfc);
  }
}
