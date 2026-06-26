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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthAlmacenGuard } from '../auth-almacen/auth-almacen.guard';
import { CreateCatalogoPromoMesDto } from './dto/create-catalogo-promo-mes.dto';
import { CreateProductoPromoMesDto } from './dto/create-producto-promo-mes.dto';
import { ListProductosPromoMesDto } from './dto/list-productos-promo-mes.dto';
import { UpdateCatalogoPromoMesDto } from './dto/update-catalogo-promo-mes.dto';
import { UpdateProductoPromoMesDto } from './dto/update-producto-promo-mes.dto';
import { ProductosPromoMesService } from './productos-promo-mes.service';

@ApiTags('Productos Promo Mes')
@Controller('almacen/v1/productos-promo-mes')
export class ProductosPromoMesAdminController {
  constructor(
    private readonly productosPromoMesService: ProductosPromoMesService,
  ) {}

  @Get('catalogos')
  @ApiOperation({ summary: 'Lista los catálogos o periodos registrados' })
  listCatalogos() {
    return this.productosPromoMesService.listCatalogos();
  }

  @Get('catalogos/:catalogoId')
  @ApiOperation({ summary: 'Obtiene un catálogo por id' })
  getCatalogo(@Param('catalogoId', ParseIntPipe) catalogoId: number) {
    return this.productosPromoMesService.getCatalogo(catalogoId);
  }

  @Post('catalogos')
  @ApiOperation({ summary: 'Crea un nuevo catálogo o periodo mensual' })
  createCatalogo(@Body() body: CreateCatalogoPromoMesDto) {
    return this.productosPromoMesService.createCatalogo(body);
  }

  @Patch('catalogos/:catalogoId')
  @ApiOperation({ summary: 'Actualiza un catálogo o periodo mensual' })
  updateCatalogo(
    @Param('catalogoId', ParseIntPipe) catalogoId: number,
    @Body() body: UpdateCatalogoPromoMesDto,
  ) {
    return this.productosPromoMesService.updateCatalogo(catalogoId, body);
  }

  @Delete('catalogos/:catalogoId')
  @ApiOperation({ summary: 'Elimina un catálogo y sus productos asociados' })
  deleteCatalogo(@Param('catalogoId', ParseIntPipe) catalogoId: number) {
    return this.productosPromoMesService.deleteCatalogo(catalogoId);
  }

  @Get('productos')
  @ApiOperation({
    summary: 'Lista productos promocionales registrados por mes',
  })
  @ApiQuery({ name: 'catalogoId', required: false, type: Number })
  listProductos(@Query() query: ListProductosPromoMesDto) {
    return this.productosPromoMesService.listProductos(query);
  }

  @Get('productos/:productoId')
  @ApiOperation({ summary: 'Obtiene un producto promocional por id' })
  getProducto(@Param('productoId', ParseIntPipe) productoId: number) {
    return this.productosPromoMesService.getProducto(productoId);
  }

  @Post('productos')
  @ApiOperation({ summary: 'Crea un producto promocional del mes' })
  createProducto(@Body() body: CreateProductoPromoMesDto) {
    return this.productosPromoMesService.createProducto(body);
  }

  @Patch('productos/:productoId')
  @ApiOperation({ summary: 'Actualiza un producto promocional del mes' })
  updateProducto(
    @Param('productoId', ParseIntPipe) productoId: number,
    @Body() body: UpdateProductoPromoMesDto,
  ) {
    return this.productosPromoMesService.updateProducto(productoId, body);
  }

  @Delete('productos/:productoId')
  @ApiOperation({ summary: 'Elimina un producto promocional del mes' })
  deleteProducto(@Param('productoId', ParseIntPipe) productoId: number) {
    return this.productosPromoMesService.deleteProducto(productoId);
  }

  @Get('mes-actual')
  @ApiOperation({
    summary:
      'Obtiene los productos nuevos del mes actual con validación contra legacy',
  })
  getMesActual() {
    return this.productosPromoMesService.getProductosMesActual({
      includePendingCodes: true,
    });
  }
}
