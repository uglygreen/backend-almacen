import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthAlmacenGuard } from './auth-almacen.guard';
import { AuthAlmacenService } from './auth-almacen.service';
import { LoginAuthAlmacenDto } from './dto/login-auth-almacen.dto';
import { RefreshAuthAlmacenDto } from './dto/refresh-auth-almacen.dto';

@ApiTags('Auth Almacen')
@Controller('almacen/v1/auth')
export class AuthAlmacenController {
  constructor(private readonly authAlmacenService: AuthAlmacenService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autenticación inicial para la nueva app de almacén' })
  login(@Body() loginDto: LoginAuthAlmacenDto) {
    return this.authAlmacenService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renueva la sesión JWT de almacén' })
  refresh(@Body() refreshDto: RefreshAuthAlmacenDto) {
    return this.authAlmacenService.refresh(refreshDto);
  }

  @Get('me')
  @UseGuards(AuthAlmacenGuard)
  @ApiOperation({ summary: 'Obtiene el perfil autenticado en almacén' })
  me(@Req() req: any) {
    return this.authAlmacenService.me(req.user.sub);
  }
}
