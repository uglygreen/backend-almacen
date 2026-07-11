import { Controller, Get, Post, Query, Res, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AsistenciaService } from './asistencia.service';
import { GetAsistenciaDto } from './dto/get-asistencia.dto';

@ApiTags('Asistencia')
@Controller('asistencia')
export class AsistenciaController {
  constructor(private readonly asistenciaService: AsistenciaService) {}

  @Get('reporte')
  @ApiOperation({ summary: 'Obtener reporte de asistencia (JSON)' })
  @ApiResponse({ status: 200, description: 'Reporte obtenido exitosamente.' })
  async obtenerReporte(@Query() dto: GetAsistenciaDto) {
    try {
      const data = await this.asistenciaService.obtenerReporte(dto);
      return { success: true, data };
    } catch (error) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('reporte/dia-actual')
  @ApiOperation({ summary: 'Obtener reporte de asistencia del día actual (JSON)' })
  @ApiResponse({ status: 200, description: 'Reporte del día actual obtenido exitosamente.' })
  async obtenerReporteDiaActual(@Query() dto: GetAsistenciaDto) {
    try {
      const data = await this.asistenciaService.obtenerReporteDiaActual(dto);
      return { success: true, data };
    } catch (error) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('reporte-almacenistas-mensual')
  @ApiOperation({ summary: 'Obtener calendario mensual de almacenistas de la sucursal principal' })
  @ApiResponse({ status: 200, description: 'Calendario mensual de almacenistas obtenido exitosamente.' })
  async obtenerReporteAlmacenistasMensual() {
    try {
      const data = await this.asistenciaService.obtenerReporteAlmacenistasMensual();
      return { success: true, data };
    } catch (error) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('excel')
  @ApiOperation({ summary: 'Descargar reporte de asistencia en Excel' })
  @ApiResponse({ status: 200, description: 'Archivo Excel generado exitosamente.' })
  async descargarExcel(@Query() dto: GetAsistenciaDto, @Res() res: any) {
    try {
      const data = await this.asistenciaService.obtenerReporte(dto);
      const workbook = await this.asistenciaService.generarExcel(data);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Asistencia.xlsx');

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
  }

  @Get('excel/dia-actual')
  @ApiOperation({ summary: 'Descargar reporte de asistencia del día actual en Excel' })
  @ApiResponse({ status: 200, description: 'Archivo Excel del día actual generado exitosamente.' })
  async descargarExcelDiaActual(@Query() dto: GetAsistenciaDto, @Res() res: any) {
    try {
      const data = await this.asistenciaService.obtenerReporteDiaActual(dto);
      const workbook = await this.asistenciaService.generarExcel(data);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Asistencia_Dia.xlsx');

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
  }

  @Get('departamentos')
  @ApiOperation({ summary: 'Obtener lista de departamentos' })
  @ApiResponse({ status: 200, description: 'Lista de departamentos obtenida exitosamente.' })
  async obtenerDepartamentos(@Query() dto: GetAsistenciaDto) {
    try {
      const data = await this.asistenciaService.obtenerDepartamentos(dto);
      return { success: true, data };
    } catch (error) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('posiciones')
  @ApiOperation({ summary: 'Obtener lista de posiciones (zonas)' })
  @ApiResponse({ status: 200, description: 'Lista de posiciones obtenida exitosamente.' })
  async obtenerPosiciones(@Query() dto: GetAsistenciaDto) {
    try {
      const data = await this.asistenciaService.obtenerPosiciones(dto);
      return { success: true, data };
    } catch (error) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('respaldo')
  @ApiOperation({ summary: 'Generar un respaldo completo de la base de datos de ZKTeco (BioTime)' })
  @ApiResponse({ status: 200, description: 'Respaldo generado exitosamente.' })
  async generarRespaldo(@Query() dto: GetAsistenciaDto) {
    try {
      const data = await this.asistenciaService.generarRespaldoBiotime(dto);
      return { success: true, data };
    } catch (error) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
