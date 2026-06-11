import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthAlmacenGuard } from '../auth-almacen/auth-almacen.guard';
import { CapturaAlmacenService } from './captura-almacen.service';
import { CreateSurtidoAlmacenDto } from './dto/create-surtido-almacen.dto';

@ApiTags('Captura Almacen')
@Controller('almacen/v1/surtidos')
@UseGuards(AuthAlmacenGuard)
export class CapturaAlmacenController {
  constructor(private readonly capturaAlmacenService: CapturaAlmacenService) {}

  @Post()
  @ApiOperation({ summary: 'Registra un nuevo surtido en sistemas.surtido' })
  createSurtido(@Body() dto: CreateSurtidoAlmacenDto) {
    return this.capturaAlmacenService.createSurtido(dto);
  }
}
