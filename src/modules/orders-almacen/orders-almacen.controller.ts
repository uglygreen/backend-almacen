import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthAlmacenGuard } from '../auth-almacen/auth-almacen.guard';
import { ValidateOrderAlmacenDto } from './dto/validate-order-almacen.dto';
import { OrdersAlmacenService } from './orders-almacen.service';

@ApiTags('Orders Almacen')
@Controller('almacen/v1/orders')
@UseGuards(AuthAlmacenGuard)
export class OrdersAlmacenController {
  constructor(private readonly ordersAlmacenService: OrdersAlmacenService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Valida un pedido antes de registrar surtido' })
  validateOrder(@Body() dto: ValidateOrderAlmacenDto) {
    return this.ordersAlmacenService.validateOrder(dto);
  }
}
