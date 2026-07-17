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
import {
  ThermalLabelType,
  ThermalLabelsAlmacenService,
  ZplMeasureUnit,
} from './thermal-labels-almacen.service';
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

  @Post('zpl-to-pdf')
  @ApiOperation({ summary: 'Convierte un archivo TXT con codigo ZPL a un PDF unificado usando Labelary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'width', 'height', 'unit'],
      properties: {
        width: {
          type: 'number',
          example: 10,
          description: 'Ancho de la etiqueta',
        },
        height: {
          type: 'number',
          example: 15,
          description: 'Alto de la etiqueta',
        },
        unit: {
          type: 'string',
          enum: ['mm', 'cm', 'in'],
          description: 'Unidad de medida recibida desde el frontend',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo TXT que contiene codigo ZPL',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        const isTxt = /\.txt$/i.test(file.originalname);
        const allowedMimeTypes = ['text/plain', 'application/octet-stream', ''];
        if (!isTxt || !allowedMimeTypes.includes(file.mimetype)) {
          return cb(new BadRequestException('Solo se permiten archivos TXT con codigo ZPL'), false);
        }
        cb(null, true);
      },
    }),
  )
  async convertZplToPdf(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('width') widthRaw: string | undefined,
    @Body('height') heightRaw: string | undefined,
    @Body('unit') unit: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!file) {
      throw new BadRequestException('Debes subir un archivo TXT');
    }

    if (!unit || !this.thermalLabelsService.isSupportedZplUnit(unit)) {
      throw new BadRequestException('unit debe ser "mm", "cm" o "in"');
    }

    const width = Number.parseFloat(widthRaw ?? '');
    const height = Number.parseFloat(heightRaw ?? '');

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new BadRequestException('width y height deben ser numeros mayores a 0');
    }

    const resultPdf = await this.thermalLabelsService.convertZplToPdf(
      file.buffer,
      width,
      height,
      unit as ZplMeasureUnit,
    );
    const outputFileName = this.thermalLabelsService.getZplDownloadFileName(file.originalname);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);

    return new StreamableFile(Buffer.from(resultPdf));
  }
}
