import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query, 
  UseInterceptors, 
  UploadedFiles, 
  ParseIntPipe,
  BadRequestException
} from '@nestjs/common';
import { GarantiasService } from './garantias.service';
import { CreateGarantiaDto, UpdateStatusDto } from './garantias.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('Garantias')
@Controller('garantias')
export class GarantiasController {
  constructor(private readonly garantiasService: GarantiasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva garantía con evidencia' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 5, {
    storage: diskStorage({
      destination: './uploads/garantias',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  async create(
    @Body() createGarantiaDto: CreateGarantiaDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    // 1. Crear la garantía base
    const garantia = await this.garantiasService.create(createGarantiaDto);

    // 2. Procesar archivos subidos (si los hay)
    if (files && files.length > 0) {
      for (const file of files) {
        // En un escenario real, aquí subiríamos a S3/Cloudinary.
        // Por ahora, simulamos que la URL es local o la ruta del archivo.
        const url = `/uploads/garantias/${file.filename}`;
        const tipo = file.mimetype.startsWith('image/') ? 'imagen' : 'video';
        await this.garantiasService.addMedia(garantia.id, url, tipo);
      }
    }

    return await this.garantiasService.findOne(garantia.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar garantías (paginado)' })
  findAll(
    @Query('page') page: number = 1, 
    @Query('limit') limit: number = 50
  ) {
    return this.garantiasService.findAll(page, limit);
  }

  @Get('ultimos-30-dias')
  @ApiOperation({ summary: 'Historial de garantías últimos 30 días' })
  findLast30Days() {
    return this.garantiasService.findLast30Days();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de garantía' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.garantiasService.findOne(id);
  }

  @Patch(':id/estatus')
  @ApiOperation({ summary: 'Actualizar estatus de garantía' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateStatusDto: UpdateStatusDto
  ) {
    return this.garantiasService.updateStatus(id, updateStatusDto);
  }

  @Get('facturas/producto/:codigo')
  @ApiOperation({ summary: 'Buscar facturas por SKU y Cliente' })
  findFacturas(
    @Param('codigo') codigo: string,
    @Query('clienteId', ParseIntPipe) clienteId: number
  ) {
    if (!clienteId) throw new BadRequestException('clienteId es requerido');
    return this.garantiasService.findFacturasPorProducto(codigo, clienteId);
  }
}
