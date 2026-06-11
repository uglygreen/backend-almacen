import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ClientesMobileAuthGuard } from './clientes-mobile-auth.guard';
import { ClientesMobileService } from './clientes-mobile.service';
import { ListDiscountedProductsClienteMobileDto } from './dto/list-discounted-products-cliente-mobile.dto';
import { LoginClienteMobileDto } from './dto/login-cliente-mobile.dto';
import { LogoutClienteMobileDto } from './dto/logout-cliente-mobile.dto';
import { RefreshClienteMobileDto } from './dto/refresh-cliente-mobile.dto';
import { SearchCatalogByBrandClienteMobileDto } from './dto/search-catalog-by-brand-cliente-mobile.dto';
import { RequestOtpClienteMobileDto } from './dto/request-otp-cliente-mobile.dto';
import { SearchCatalogClienteMobileDto } from './dto/search-catalog-cliente-mobile.dto';
import { VerifyOtpClienteMobileDto } from './dto/verify-otp-cliente-mobile.dto';

@ApiTags('Clientes Mobile')
@Controller('clientes-mobile/v1')
export class ClientesMobileController {
  constructor(private readonly clientesMobileService: ClientesMobileService) {}

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login directo transicional de cliente móvil con número de cliente y correo' })
  login(@Body() loginDto: LoginClienteMobileDto, @Req() req: any) {
    return this.clientesMobileService.login(loginDto, req);
  }

  @Post('auth/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicita un código OTP para login de cliente móvil' })
  requestOtp(@Body() body: RequestOtpClienteMobileDto, @Req() req: any) {
    return this.clientesMobileService.requestOtp(body, req);
  }

  @Post('auth/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifica el OTP y crea sesión para el cliente móvil' })
  verifyOtp(@Body() body: VerifyOtpClienteMobileDto, @Req() req: any) {
    return this.clientesMobileService.verifyOtp(body, req);
  }

  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renueva la sesión JWT del cliente móvil' })
  refresh(@Body() refreshDto: RefreshClienteMobileDto, @Req() req: any) {
    return this.clientesMobileService.refresh(refreshDto, req);
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoca la sesión del cliente móvil usando el refresh token' })
  logout(@Body() logoutDto: LogoutClienteMobileDto) {
    return this.clientesMobileService.logout(logoutDto);
  }

  @Get('auth/validate')
  @UseGuards(ClientesMobileAuthGuard)
  @ApiOperation({ summary: 'Valida si el token del cliente móvil sigue activo' })
  validate(@Req() req: any) {
    return this.clientesMobileService.validate(req.user.sub);
  }

  @Get('auth/me')
  @UseGuards(ClientesMobileAuthGuard)
  @ApiOperation({ summary: 'Obtiene el perfil autenticado del cliente móvil' })
  me(@Req() req: any) {
    return this.clientesMobileService.me(req.user.sub);
  }

  @Get('account/statement')
  @UseGuards(ClientesMobileAuthGuard)
  @ApiOperation({ summary: 'Obtiene el estado de cuenta del cliente móvil autenticado' })
  statement(@Req() req: any) {
    return this.clientesMobileService.getEstadoCuenta(req.user.sub);
  }

  @Get('catalog/search')
  @UseGuards(ClientesMobileAuthGuard)
  @ApiOperation({ summary: 'Busca productos del catálogo mobile usando el descuento del cliente autenticado' })
  @ApiQuery({ name: 'q', required: true, type: String, example: 'desbrozadora' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  searchCatalog(@Req() req: any, @Query() query: SearchCatalogClienteMobileDto) {
    return this.clientesMobileService.searchCatalog(req.user.sub, query);
  }

  @Get('catalog/search-by-brand')
  @UseGuards(ClientesMobileAuthGuard)
  @ApiOperation({ summary: 'Busca productos del catálogo mobile por marca usando XXMARCA' })
  @ApiQuery({ name: 'marca', required: true, type: String, example: 'truper' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  searchCatalogByBrand(@Req() req: any, @Query() query: SearchCatalogByBrandClienteMobileDto) {
    return this.clientesMobileService.searchCatalogByBrand(req.user.sub, query);
  }

  @Get('catalog/discounted')
  @UseGuards(ClientesMobileAuthGuard)
  @ApiOperation({ summary: 'Lista productos con descuento para la pantalla de inicio del cliente mobile' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 12 })
  getDiscountedProducts(@Req() req: any, @Query() query: ListDiscountedProductsClienteMobileDto) {
    return this.clientesMobileService.getDiscountedProducts(req.user.sub, query);
  }

  @Get('catalog/:articuloId')
  @UseGuards(ClientesMobileAuthGuard)
  @ApiOperation({ summary: 'Obtiene el detalle de un producto del catálogo mobile por articuloId' })
  getCatalogProductDetail(@Req() req: any, @Param('articuloId', ParseIntPipe) articuloId: number) {
    return this.clientesMobileService.getCatalogProductDetail(req.user.sub, articuloId);
  }
}
