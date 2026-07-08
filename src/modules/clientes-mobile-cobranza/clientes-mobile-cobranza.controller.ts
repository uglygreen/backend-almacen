import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ClientesMobileAuthGuard } from '../clientes-mobile/clientes-mobile-auth.guard';
import { ListClientesMobileFacturasDto } from './dto/list-clientes-mobile-facturas.dto';
import { ClientesMobileCobranzaService } from './clientes-mobile-cobranza.service';

@ApiTags('Clientes Mobile Cobranza')
@Controller('clientes-mobile')
export class ClientesMobileCobranzaController {
  constructor(
    private readonly clientesMobileCobranzaService: ClientesMobileCobranzaService,
  ) {}

  @Get('facturas')
  @UseGuards(ClientesMobileAuthGuard)
  @ApiOperation({ summary: 'Lista facturas del cliente autenticado por rango de fechas con paginación' })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2026-07-01' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2026-07-31' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 5, enum: [5, 10] })
  @ApiQuery({ name: 'includeComplementos', required: false, type: Boolean, example: false })
  listFacturas(@Req() req: any, @Query() query: ListClientesMobileFacturasDto) {
    return this.clientesMobileCobranzaService.listFacturas(req.user.sub, query, req);
  }

  @Get('facturas/:docId/xml')
  @UseGuards(ClientesMobileAuthGuard)
  @ApiOperation({ summary: 'Descarga el XML de una factura del cliente autenticado' })
  async downloadFacturaXml(
    @Req() req: any,
    @Param('docId', ParseIntPipe) docId: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.clientesMobileCobranzaService.downloadFacturaXml(req.user.sub, docId);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return new StreamableFile(file.content);
  }

  @Get('facturas/:docId/pdf')
  @UseGuards(ClientesMobileAuthGuard)
  @ApiOperation({ summary: 'Descarga el PDF de una factura del cliente autenticado construido desde su XML CFDI' })
  async downloadFacturaPdf(
    @Req() req: any,
    @Param('docId', ParseIntPipe) docId: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.clientesMobileCobranzaService.downloadFacturaPdf(req.user.sub, docId);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return new StreamableFile(file.content);
  }

  @Get('complementos/:cpId/xml')
  @UseGuards(ClientesMobileAuthGuard)
  @ApiOperation({ summary: 'Descarga el XML de un complemento de pago del cliente autenticado' })
  async downloadComplementoXml(
    @Req() req: any,
    @Param('cpId', ParseIntPipe) cpId: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.clientesMobileCobranzaService.downloadComplementoXml(req.user.sub, cpId);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return new StreamableFile(file.content);
  }

  @Get('complementos/:cpId/pdf')
  @UseGuards(ClientesMobileAuthGuard)
  @ApiOperation({ summary: 'Descarga el PDF de un complemento de pago del cliente autenticado construido desde su XML CFDI' })
  async downloadComplementoPdf(
    @Req() req: any,
    @Param('cpId', ParseIntPipe) cpId: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.clientesMobileCobranzaService.downloadComplementoPdf(req.user.sub, cpId);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return new StreamableFile(file.content);
  }
}
