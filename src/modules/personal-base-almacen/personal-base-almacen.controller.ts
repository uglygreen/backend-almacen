import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthAlmacenGuard } from '../auth-almacen/auth-almacen.guard';
import {
  UpdateManyPersonalBaseConfigDto,
  UpdatePersonalBaseConfigDto,
} from './dto/update-personal-base-config.dto';
import { PersonalBaseAlmacenService } from './personal-base-almacen.service';

// @UseGuards(AuthAlmacenGuard)
@ApiTags('Personal Base Almacen')
@Controller('almacen/v1/personal-base')
export class PersonalBaseAlmacenController {
  constructor(private readonly personalBaseAlmacenService: PersonalBaseAlmacenService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene la configuración de base de personal por area y seccion' })
  listConfiguraciones() {
    return this.personalBaseAlmacenService.listConfiguraciones();
  }

  @Patch()
  @ApiOperation({ summary: 'Actualiza una configuración de base de personal' })
  updateConfiguracion(@Body() body: UpdatePersonalBaseConfigDto) {
    return this.personalBaseAlmacenService.updateConfiguracion(body);
  }

  @Put()
  @ApiOperation({ summary: 'Actualiza varias configuraciones de base de personal' })
  updateManyConfiguraciones(@Body() body: UpdateManyPersonalBaseConfigDto) {
    return this.personalBaseAlmacenService.updateManyConfiguraciones(body.configuraciones);
  }
}
