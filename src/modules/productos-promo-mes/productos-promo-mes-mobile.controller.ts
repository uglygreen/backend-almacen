import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClientesMobileAuthGuard } from '../clientes-mobile/clientes-mobile-auth.guard';
import { ProductosPromoMesService } from './productos-promo-mes.service';

@ApiTags('Clientes Mobile')
@Controller('clientes-mobile/v1/productos-nuevos')
@UseGuards(ClientesMobileAuthGuard)
export class ProductosPromoMesMobileController {
  constructor(
    private readonly productosPromoMesService: ProductosPromoMesService,
  ) {}

  @Get('mes-actual')
  @ApiOperation({
    summary:
      'Obtiene los productos nuevos del mes actual disponibles en legacy',
  })
  getMesActual() {
    return this.productosPromoMesService.getProductosMesActual();
  }
}
