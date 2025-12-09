import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginUsuarioDto } from './dto/login-usuario.dto';


@ApiTags('Usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión para un usuario del almacén' })
  @ApiResponse({ status: 200, description: 'Inicio de sesión exitoso.'})
  @ApiResponse({ status: 401, description: 'Usuario inactivo.'})
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.'})
  login(@Body() loginUsuarioDto: LoginUsuarioDto) {
    return this.usuariosService.login(loginUsuarioDto);
  }
}
