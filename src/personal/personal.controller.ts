import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { PersonalService } from './personal.service';

@Controller('personal')
export class PersonalController {
  constructor(private readonly personalService: PersonalService) {}

  // Endpoint para buscar todos los que tienen el perfil vacío
  // Ruta: GET /personal/sin-perfil
  @Get('sin-perfil')
  getSinPerfil() {
    return this.personalService.findSinPerfil();
  }

  // Endpoint para buscar por ID
  // Ruta: GET /personal/123
  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.personalService.findById(id);
  }
}