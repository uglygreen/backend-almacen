import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThermalLabelType, ThermalLabelsAlmacenService } from './thermal-labels-almacen.service';
import type { Response } from 'express';

@ApiTags('Thermal Labels Almacen')
@Controller('almacen/v1/thermal-labels')
export class ThermalLabelsAlmacenController {
  constructor(private readonly thermalLabelsService: ThermalLabelsAlmacenService) {}

  @Post('adapt')
  @ApiOperation({ summary: 'Adapta un PDF a formato de impresion termica segun el tipo de etiqueta' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'labelType'],
      properties: {
        labelType: {
          type: 'string',
          enum: ['bulto', 'producto'],
          description: 'Tipo de etiqueta termica a generar',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo PDF original a convertir',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 25 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Solo se permiten archivos PDF'), false);
        }
        cb(null, true);
      },
    }),
  )
  async adaptPdf(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('labelType') labelType: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!file) {
      throw new BadRequestException('Debes subir un archivo PDF');
    }

    if (!labelType || !this.thermalLabelsService.isSupportedLabelType(labelType)) {
      throw new BadRequestException('labelType debe ser "bulto" o "producto"');
    }

    const resultPdf = await this.thermalLabelsService.adaptPdf(file.buffer, labelType as ThermalLabelType);
    const outputFileName = this.thermalLabelsService.getDownloadFileName(file.originalname, labelType);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);

    return new StreamableFile(Buffer.from(resultPdf));
  }
}
