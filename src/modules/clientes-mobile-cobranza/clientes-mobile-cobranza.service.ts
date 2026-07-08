import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bwipjs from 'bwip-js';
import { existsSync, readFileSync } from 'fs';
import PDFDocument from 'pdfkit';
import { join } from 'path';
import { In, Repository } from 'typeorm';
import { CfdLegacy, Cliente, CompagLegacy, DocLegacy, PagDocLegacy } from '../../entities';
import { ListClientesMobileFacturasDto } from './dto/list-clientes-mobile-facturas.dto';

type FilePayload = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

type FacturaComplementoResumen = {
  compagId: number;
  folio: string;
  fecha: string | null;
  montoTotal: number;
  montoAplicadoFactura: number;
  estado: string | null;
  uuid: string | null;
  xmlDisponible: boolean;
  links?: {
    xml: string | null;
    pdf: string | null;
  };
};

type ParsedCfdiParty = {
  rfc: string | null;
  nombre: string | null;
  regimenFiscal: string | null;
  domicilioFiscal: string | null;
  usoCfdi: string | null;
};

type ParsedTimbreFiscal = {
  uuid: string | null;
  fechaTimbrado: string | null;
  noCertificadoSat: string | null;
  selloCfd: string | null;
  selloSat: string | null;
  rfcProvCertif: string | null;
};

type ParsedInvoiceConcept = {
  claveProdServ: string | null;
  noIdentificacion: string | null;
  cantidad: number;
  claveUnidad: string | null;
  unidad: string | null;
  descripcion: string | null;
  valorUnitario: number;
  importe: number;
  impuestoImporte: number;
};

type ParsedPaymentDocument = {
  idDocumento: string | null;
  serie: string | null;
  folio: string | null;
  numParcialidad: string | null;
  impSaldoAnt: number;
  impPagado: number;
  impSaldoInsoluto: number;
  impuestoImporte: number;
};

type ParsedPaymentEntry = {
  fechaPago: string | null;
  formaDePagoP: string | null;
  monedaP: string | null;
  tipoCambioP: string | null;
  monto: number;
  doctosRelacionados: ParsedPaymentDocument[];
};

type ParsedCfdiDocument = {
  tipoDeComprobante: string | null;
  version: string | null;
  serie: string | null;
  folio: string | null;
  fecha: string | null;
  subtotal: number;
  total: number;
  moneda: string | null;
  formaPago: string | null;
  metodoPago: string | null;
  exportacion: string | null;
  lugarExpedicion: string | null;
  noCertificado: string | null;
  sello: string | null;
  emisor: ParsedCfdiParty;
  receptor: ParsedCfdiParty;
  timbre: ParsedTimbreFiscal;
  conceptos: ParsedInvoiceConcept[];
  totalImpuestosTrasladados: number;
  pagos: ParsedPaymentEntry[];
  totalMontoPagos: number;
  qrUrl: string | null;
};

@Injectable()
export class ClientesMobileCobranzaService {
  constructor(
    @InjectRepository(DocLegacy, 'legacy_db')
    private readonly docRepository: Repository<DocLegacy>,
    @InjectRepository(CfdLegacy, 'legacy_db')
    private readonly cfdRepository: Repository<CfdLegacy>,
    @InjectRepository(PagDocLegacy, 'legacy_db')
    private readonly pagDocRepository: Repository<PagDocLegacy>,
    @InjectRepository(CompagLegacy, 'legacy_db')
    private readonly compagRepository: Repository<CompagLegacy>,
  ) {}

  async listFacturas(clienteId: number, query: ListClientesMobileFacturasDto, request?: any) {
    const { from, to } = this.resolveDateRange(query.from, query.to);
    const page = query.page ?? 1;
    const limit = query.limit ?? 5;
    const includeComplementos = query.includeComplementos ?? false;

    const [facturas, total] = await this.docRepository
      .createQueryBuilder('doc')
      .where('doc.clienteId = :clienteId', { clienteId })
      .andWhere('doc.tipo = :tipo', { tipo: 'F' })
      .andWhere('doc.fecha >= :from', { from: this.formatDate(from) })
      .andWhere('doc.fecha <= :to', { to: this.formatDate(to) })
      .orderBy('doc.fecha', 'DESC')
      .addOrderBy('doc.numero', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const docIds = facturas.map((factura) => factura.docId);
    const cfds = docIds.length > 0
      ? await this.cfdRepository.find({
          where: { docId: In(docIds) },
          order: { fecha: 'DESC', cfdId: 'DESC' },
        })
      : [];

    const cfdsByDocId = new Map<number, CfdLegacy[]>();
    for (const cfd of cfds) {
      const items = cfdsByDocId.get(cfd.docId) ?? [];
      items.push(cfd);
      cfdsByDocId.set(cfd.docId, items);
    }

    const complementosPorDocId = includeComplementos
      ? await this.loadComplementosByDocIds(docIds, request)
      : new Map<number, FacturaComplementoResumen[]>();

    const items = facturas.map((factura) => {
      const cfd = this.pickPrimaryCfd(cfdsByDocId.get(factura.docId) ?? []);
      const complementos = complementosPorDocId.get(factura.docId) ?? [];
      const saldoPendiente = this.toMoney(this.toNumber(factura.total) - this.toNumber(factura.totalPagado));
      const xmlUrl = cfd?.xml ? this.buildAbsoluteUrl(request, `/clientes-mobile/facturas/${factura.docId}/xml`) : null;
      const pdfUrl = this.buildAbsoluteUrl(request, `/clientes-mobile/facturas/${factura.docId}/pdf`);

      return {
        docId: factura.docId,
        folio: this.buildFolio(factura.serie, factura.numero),
        serie: this.cleanNullableString(factura.serie),
        numero: this.toNumber(factura.numero),
        fecha: this.formatNullableDate(factura.fecha),
        fechaDocumento: this.formatNullableDateTime(factura.docFecha),
        vencimiento: this.formatNullableDate(factura.vence),
        estado: this.cleanNullableString(factura.estado),
        estadoCfd: this.cleanNullableString(factura.estadoCfd),
        subtotal: this.toMoney(
          this.toNumber(factura.subtotal0) + this.toNumber(factura.subtotal1) + this.toNumber(factura.subtotal2),
        ),
        descuento: this.toMoney(factura.docDescuentoDes ?? factura.descuento),
        impuesto: this.toMoney(factura.impuesto),
        total: this.toMoney(factura.total),
        totalPagado: this.toMoney(factura.totalPagado),
        saldoPendiente,
        uuid: this.cleanNullableString(cfd?.uuid),
        xmlDisponible: Boolean(cfd?.xml),
        pdfDisponible: true,
        links: {
          xml: xmlUrl,
          pdf: pdfUrl,
        },
        ...(includeComplementos ? { complementos } : {}),
      };
    });

    return {
      filtros: {
        from: this.formatDate(from),
        to: this.formatDate(to),
        includeComplementos,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
        hasMore: page * limit < total,
      },
      items,
    };
  }

  async downloadFacturaXml(clienteId: number, docId: number): Promise<FilePayload> {
    const { factura, cfd } = await this.findFacturaWithPrimaryCfd(clienteId, docId);
    if (!cfd?.xml) {
      throw new NotFoundException(`La factura ${docId} no cuenta con XML disponible`);
    }

    return {
      fileName: `${this.buildSafeFileName(factura, cfd)}.xml`,
      contentType: 'application/xml; charset=utf-8',
      content: Buffer.from(cfd.xml, 'utf8'),
    };
  }

  async downloadFacturaPdf(clienteId: number, docId: number): Promise<FilePayload> {
    const { factura, cfd } = await this.findFacturaWithPrimaryCfd(clienteId, docId);
    const pdfBytes = await this.buildFacturaPdf(factura, cfd);

    return {
      fileName: `${this.buildSafeFileName(factura, cfd)}.pdf`,
      contentType: 'application/pdf',
      content: Buffer.from(pdfBytes),
    };
  }

  async downloadComplementoXml(clienteId: number, cpId: number): Promise<FilePayload> {
    const { complemento, cfd } = await this.findComplementoWithCfd(clienteId, cpId);
    if (!cfd?.xml) {
      throw new NotFoundException(`El complemento ${cpId} no cuenta con XML disponible`);
    }

    return {
      fileName: `${this.buildComplementoFileName(complemento, cfd)}.xml`,
      contentType: 'application/xml; charset=utf-8',
      content: Buffer.from(cfd.xml, 'utf8'),
    };
  }

  async downloadComplementoPdf(clienteId: number, cpId: number): Promise<FilePayload> {
    const { complemento, cfd } = await this.findComplementoWithCfd(clienteId, cpId);
    if (!cfd?.xml) {
      throw new NotFoundException(`El complemento ${cpId} no cuenta con XML disponible`);
    }

    const pdfBytes = await this.buildCfdiPdfFromXml(cfd.xml);

    return {
      fileName: `${this.buildComplementoFileName(complemento, cfd)}.pdf`,
      contentType: 'application/pdf',
      content: Buffer.from(pdfBytes),
    };
  }

  private async loadComplementosByDocIds(docIds: number[], request?: any) {
    if (docIds.length === 0) {
      return new Map<number, FacturaComplementoResumen[]>();
    }

    const rows = await this.pagDocRepository
      .createQueryBuilder('pagDoc')
      .leftJoinAndSelect('pagDoc.pago', 'pago')
      .leftJoinAndSelect('pago.complementoPago', 'compag')
      .leftJoinAndSelect('compag.cfd', 'compagCfd')
      .where('pagDoc.docId IN (:...docIds)', { docIds })
      .andWhere('compag.cpId IS NOT NULL')
      .orderBy('compag.cpFecha', 'DESC')
      .addOrderBy('compag.cpId', 'DESC')
      .getMany();

    const grouped = new Map<string, FacturaComplementoResumen>();

    for (const row of rows) {
      const complemento = row.pago?.complementoPago;
      if (!complemento?.cpId) {
        continue;
      }

      const compagCfd = complemento.cfd ?? null;
      const key = `${row.docId}:${complemento.cpId}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.montoAplicadoFactura = this.toMoney(existing.montoAplicadoFactura + this.toNumber(row.pagado));
        continue;
      }

      grouped.set(key, {
        compagId: complemento.cpId,
        folio: this.buildFolio(complemento.cpSerie, complemento.cpFolio),
        fecha: this.formatNullableDate(complemento.cpFecha),
        montoTotal: this.toMoney(complemento.cpMontoTotal),
        montoAplicadoFactura: this.toMoney(row.pagado),
        estado: this.cleanNullableString(complemento.cpEstado),
        uuid: this.cleanNullableString(compagCfd?.uuid),
        xmlDisponible: Boolean(compagCfd?.xml),
        links: {
          xml: compagCfd?.xml
            ? this.buildAbsoluteUrl(request, `/clientes-mobile/complementos/${complemento.cpId}/xml`)
            : null,
          pdf: compagCfd?.xml
            ? this.buildAbsoluteUrl(request, `/clientes-mobile/complementos/${complemento.cpId}/pdf`)
            : null,
        },
      });
    }

    const byDocId = new Map<number, FacturaComplementoResumen[]>();
    for (const [key, value] of grouped.entries()) {
      const [docIdRaw] = key.split(':');
      const docId = Number(docIdRaw);
      const items = byDocId.get(docId) ?? [];
      items.push(value);
      byDocId.set(docId, items);
    }

    return byDocId;
  }

  private async findFacturaWithPrimaryCfd(clienteId: number, docId: number) {
    const factura = await this.docRepository.findOne({
      where: {
        docId,
        clienteId,
        tipo: 'F',
      },
      relations: ['cliente'],
    });

    if (!factura) {
      throw new NotFoundException(`No se encontró la factura ${docId}`);
    }

    const cfds = await this.cfdRepository.find({
      where: { docId },
      order: { fecha: 'DESC', cfdId: 'DESC' },
    });

    return {
      factura,
      cfd: this.pickPrimaryCfd(cfds),
    };
  }

  private async findComplementoWithCfd(clienteId: number, cpId: number) {
    const complemento = await this.compagRepository.findOne({
      where: {
        cpId,
        cpClienteId: clienteId,
      },
      relations: ['cfd', 'cliente'],
    });

    if (!complemento) {
      throw new NotFoundException(`No se encontró el complemento ${cpId}`);
    }

    return {
      complemento,
      cfd: complemento.cfd ?? null,
    };
  }

  private pickPrimaryCfd(cfds: CfdLegacy[]): CfdLegacy | null {
    if (!cfds.length) {
      return null;
    }

    const sorted = [...cfds].sort((a, b) => {
      const scoreA = this.getCfdPriority(a);
      const scoreB = this.getCfdPriority(b);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      const dateA = this.safeDateToMs(a.fecha) || this.safeDateToMs(a.cambiado);
      const dateB = this.safeDateToMs(b.fecha) || this.safeDateToMs(b.cambiado);
      return dateB - dateA || b.cfdId - a.cfdId;
    });

    return sorted[0] ?? null;
  }

  private getCfdPriority(cfd: CfdLegacy): number {
    const estado = (cfd.estado ?? '').trim().toUpperCase();
    if (estado === 'A' || estado === 'T' || estado === 'V') {
      return 3;
    }

    if (cfd.xml) {
      return 2;
    }

    return 1;
  }

  private async buildFacturaPdf(factura: DocLegacy, cfd: CfdLegacy | null) {
    if (cfd?.xml) {
      return this.buildCfdiPdfFromXml(cfd.xml);
    }

    return this.buildFallbackFacturaPdf(factura, cfd);
  }

  private async buildCfdiPdfFromXml(xml: string): Promise<Buffer> {
    const parsed = this.parseCfdiXml(xml);
    const qrBuffer = parsed.qrUrl ? await this.generateSatQrPng(parsed.qrUrl) : null;

    return new Promise((resolve) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 36, bottom: 36, left: 36, right: 36 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      if (parsed.tipoDeComprobante === 'P') {
        this.renderComplementoPdf(doc, parsed, qrBuffer);
      } else {
        this.renderFacturaPdf(doc, parsed, qrBuffer);
      }

      doc.end();
    });
  }

  private async buildFallbackFacturaPdf(factura: DocLegacy, cfd: CfdLegacy | null): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 36, bottom: 36, left: 36, right: 36 },
      });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.font('Helvetica-Bold').fontSize(18).text('Factura sin XML disponible');
      doc.moveDown();
      doc.font('Helvetica').fontSize(11);
      doc.text(`Factura: ${this.buildFolio(factura.serie, factura.numero)}`);
      doc.text(`Fecha: ${this.formatNullableDate(factura.fecha) ?? 'N/D'}`);
      doc.text(`Cliente: ${this.cleanNullableString((factura.cliente as Cliente | undefined)?.nombre) ?? `${factura.clienteId}`}`);
      doc.text(`UUID: ${this.cleanNullableString(cfd?.uuid) ?? 'N/D'}`);
      doc.text(`Total: ${this.formatMoney(factura.total)}`);
      doc.text(`Pagado: ${this.formatMoney(factura.totalPagado)}`);
      doc.text(`Saldo pendiente: ${this.formatMoney(this.toNumber(factura.total) - this.toNumber(factura.totalPagado))}`);
      doc.moveDown();
      doc.text(
        'No se encontró el XML del CFDI para construir una representación fiscal detallada. '
          + 'Este PDF se genera con la información disponible en base de datos.',
      );

      doc.end();
    });
  }

  private resolveDateRange(fromInput?: string, toInput?: string) {
    const today = new Date();
    const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultTo = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const from = fromInput ? this.parseDateOnly(fromInput) : defaultFrom;
    const to = toInput ? this.parseDateOnly(toInput) : defaultTo;

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('La fecha inicial no puede ser mayor que la fecha final');
    }

    return { from, to };
  }

  private parseDateOnly(value: string) {
    const [year, month, day] = value.split('-').map((item) => Number(item));
    const parsed = new Date(year, (month || 1) - 1, day || 1);

    if (!Number.isFinite(parsed.getTime())) {
      throw new BadRequestException(`Fecha inválida: ${value}`);
    }

    return parsed;
  }

  private buildAbsoluteUrl(request: any, path: string) {
    const normalizedPath = path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
    const forwardedProto = request?.headers?.['x-forwarded-proto'];
    const forwardedHost = request?.headers?.['x-forwarded-host'];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto || request?.protocol || 'http';
    const host = Array.isArray(forwardedHost)
      ? forwardedHost[0]
      : forwardedHost || request?.headers?.host;

    if (!host) {
      return normalizedPath;
    }

    return `${protocol}://${host}${normalizedPath}`;
  }

  private buildFolio(serie: string | null | undefined, numero: number | string | null | undefined) {
    const cleanSerie = (serie ?? '').trim();
    const cleanNumero = `${numero ?? ''}`.trim();

    if (cleanSerie && cleanNumero) {
      return `${cleanSerie}-${cleanNumero}`;
    }

    return cleanSerie || cleanNumero || 'SIN-FOLIO';
  }

  private buildSafeFileName(factura: DocLegacy, cfd: CfdLegacy | null) {
    const base = cfd
      ? this.buildFolio(cfd.serie, cfd.folio)
      : this.buildFolio(factura.serie, factura.numero);

    return base.replace(/[^a-zA-Z0-9-_]+/g, '_');
  }

  private safeDateToMs(value: Date | string | null | undefined) {
    if (!value) {
      return 0;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
  }

  private loadBrandLogo(): Buffer | null {
    try {
      const logoPath = join(process.cwd(), 'logo-extendido.png');
      if (!existsSync(logoPath)) {
        return null;
      }

      return readFileSync(logoPath);
    } catch {
      return null;
    }
  }

  private renderFacturaPdf(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument, qrBuffer: Buffer | null) {
    this.drawFacturaHeaderReference(doc, parsed);
    this.drawFacturaReceiverAndPaymentCards(doc, parsed);
    this.drawFacturaConceptsReferenceTable(doc, parsed.conceptos);
    this.drawInvoiceTotalsReference(doc, parsed);
    this.drawTimbreBlock(doc, parsed, qrBuffer);
  }

  private renderComplementoPdf(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument, qrBuffer: Buffer | null) {
    this.drawComplementoHeaderReference(doc, parsed);
    this.drawComplementoReceiverAndPaymentCards(doc, parsed);
    this.drawComplementoDocumentsTable(doc, parsed);
    this.drawTimbreBlock(doc, parsed, qrBuffer);
  }

  private drawFacturaHeaderReference(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument) {
    const leftX = 24;
    const topY = 24;
    const logo = this.loadBrandLogo();

    if (logo) {
      doc.image(logo, leftX, topY + 4, { fit: [260, 74] });
    }

    doc.fillColor('#374151').font('Helvetica-Bold').fontSize(10);
    doc.text(`RFC: ${parsed.emisor.rfc ?? 'N/D'}`, leftX + 6, topY + 74);
    doc.font('Helvetica').fontSize(9);
    doc.text(`Regimen Fiscal: ${parsed.emisor.regimenFiscal ?? 'N/D'}`, leftX + 6, topY + 92);
    doc.text(`Lugar de Expedicion (CP): ${parsed.lugarExpedicion ?? 'N/D'}`, leftX + 6, topY + 106);

    const boxX = 324;
    const boxY = topY;
    const boxWidth = 252;
    const boxHeight = 148;
    doc.save();
    doc.rect(boxX, boxY, boxWidth, boxHeight).fill('#F3F4F6');
    doc.rect(boxX, boxY, boxWidth, boxHeight).strokeColor('#D1D5DB').lineWidth(1).stroke();
    doc.restore();

    doc.fillColor('#23408E').font('Helvetica-Bold').fontSize(18).text('FACTURA', boxX + 14, boxY + 12, {
      width: boxWidth - 28,
      align: 'right',
    });
    doc.fillColor('#374151').font('Helvetica-Bold').fontSize(9);
    doc.text('Serie/Folio:', boxX + 12, boxY + 42);
    doc.text('Fecha Emision:', boxX + 12, boxY + 58);
    doc.text('Folio Fiscal', boxX + 12, boxY + 74);
    doc.text('(UUID):', boxX + 12, boxY + 86);
    doc.text('No. Certificado:', boxX + 12, boxY + 102);
    doc.text('Tipo', boxX + 12, boxY + 118);
    doc.text('Comprobante:', boxX + 12, boxY + 130);

    doc.font('Helvetica').fontSize(9).fillColor('#111827');
    doc.text(this.buildFolio(parsed.serie, parsed.folio), boxX + 118, boxY + 42, { width: 118, align: 'right' });
    doc.text(parsed.fecha ?? 'N/D', boxX + 118, boxY + 58, { width: 118, align: 'right' });
    doc.text(parsed.timbre.uuid ?? 'N/D', boxX + 118, boxY + 74, { width: 118, align: 'right' });
    doc.text(parsed.noCertificado ?? 'N/D', boxX + 118, boxY + 102, { width: 118, align: 'right' });
    doc.text(this.formatTipoComprobante(parsed), boxX + 118, boxY + 118, { width: 118, align: 'right' });

    doc.y = topY + 160;
  }

  private drawFacturaReceiverAndPaymentCards(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument) {
    const startY = doc.y + 8;
    const leftX = 24;
    const rightX = 302;
    const leftWidth = 264;
    const rightWidth = 274;
    const cardHeight = 108;
    const headerColor = '#2F4EA2';

    this.drawPanelCard(doc, leftX, startY, leftWidth, cardHeight, 'DATOS DEL RECEPTOR', headerColor);
    this.drawPanelCard(doc, rightX, startY, rightWidth, cardHeight, 'DETALLES DE PAGO', headerColor);

    this.drawInlineField(doc, 'Nombre', parsed.receptor.nombre ?? 'N/D', leftX + 8, startY + 34, 244);
    this.drawInlineField(doc, 'RFC', parsed.receptor.rfc ?? 'N/D', leftX + 8, startY + 50, 244);
    this.drawInlineField(doc, 'Domicilio Fiscal CP', parsed.receptor.domicilioFiscal ?? 'N/D', leftX + 8, startY + 66, 244);
    this.drawInlineField(doc, 'Regimen Fiscal', parsed.receptor.regimenFiscal ?? 'N/D', leftX + 8, startY + 82, 244);
    this.drawInlineField(doc, 'Uso CFDI', parsed.receptor.usoCfdi ?? 'N/D', leftX + 8, startY + 98, 244);

    this.drawInlineField(doc, 'Metodo de Pago', parsed.metodoPago ?? 'N/D', rightX + 8, startY + 34, 254);
    this.drawInlineField(doc, 'Forma de Pago', parsed.formaPago ?? 'N/D', rightX + 8, startY + 50, 254);
    this.drawInlineField(doc, 'Moneda', parsed.moneda ?? 'N/D', rightX + 8, startY + 66, 254);
    this.drawInlineField(doc, 'Exportacion', parsed.exportacion ?? 'N/D', rightX + 8, startY + 82, 254);

    doc.y = startY + cardHeight + 18;
  }

  private drawFacturaConceptsReferenceTable(doc: PDFKit.PDFDocument, conceptos: ParsedInvoiceConcept[]) {
    const columns = {
      claveSat: 24,
      noIdentif: 94,
      cantidad: 178,
      unidad: 222,
      descripcion: 282,
      unitario: 452,
      importe: 522,
    };

    const drawHeader = () => {
      const y = doc.y;
      doc.save();
      doc.rect(24, y, 552, 26).fill('#2D5FD4');
      doc.restore();
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
      doc.text('Clave SAT', columns.claveSat + 6, y + 8, { width: 64 });
      doc.text('No. Identif.', columns.noIdentif + 6, y + 8, { width: 76 });
      doc.text('Cant.', columns.cantidad, y + 8, { width: 34, align: 'right' });
      doc.text('Unidad', columns.unidad + 6, y + 8, { width: 48 });
      doc.text('Descripcion', columns.descripcion + 6, y + 8, { width: 154 });
      doc.text('P. Unitario', columns.unitario, y + 8, { width: 54, align: 'right' });
      doc.text('Importe', columns.importe, y + 8, { width: 48, align: 'right' });
      doc.fillColor('#111827');
      doc.y = y + 32;
    };

    drawHeader();

    conceptos.forEach((concepto, index) => {
      const descripcion = concepto.descripcion ?? 'N/D';
      const rowHeight = Math.max(
        24,
        Math.max(
          doc.heightOfString(descripcion, { width: 156 }) + 8,
          doc.heightOfString(concepto.unidad ?? 'N/D', { width: 48 }) + 8,
        ),
      );
      this.ensurePdfSpace(doc, rowHeight + 26, drawHeader);

      const y = doc.y;
      doc.save();
      doc.rect(24, y, 552, rowHeight).fill(index % 2 === 0 ? '#F8FAFC' : '#FFFFFF');
      doc.restore();

      doc.font('Helvetica').fontSize(8.5).fillColor('#111827');
      doc.text(concepto.claveProdServ ?? 'N/D', columns.claveSat + 6, y + 7, { width: 64 });
      doc.text(concepto.noIdentificacion ?? 'N/D', columns.noIdentif + 6, y + 7, { width: 76 });
      doc.text(this.formatQuantity(concepto.cantidad), columns.cantidad, y + 7, { width: 34, align: 'right' });
      doc.text(concepto.unidad ?? 'N/D', columns.unidad + 6, y + 7, { width: 48 });
      doc.text(descripcion, columns.descripcion + 6, y + 7, { width: 156 });
      doc.text(this.formatCurrencyMoney(concepto.valorUnitario), columns.unitario, y + 7, { width: 54, align: 'right' });
      doc.text(this.formatCurrencyMoney(concepto.importe), columns.importe, y + 7, { width: 48, align: 'right' });
      doc.y = y + rowHeight + 2;
    });
  }

  private drawInvoiceTotalsReference(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument) {
    this.ensurePdfSpace(doc, 110);
    const x = 332;
    const y = doc.y + 10;
    const width = 244;
    const height = 92;

    doc.save();
    doc.roundedRect(x, y, width, height, 4).fill('#FFFFFF');
    doc.roundedRect(x, y, width, height, 4).strokeColor('#D1D5DB').lineWidth(1).stroke();
    doc.rect(x, y, width, 24).fill('#2F4EA2');
    doc.restore();

    doc.fillColor('#111827').font('Helvetica').fontSize(10);
    doc.text('Subtotal', x + 18, y + 36, { width: 90 });
    doc.text(this.formatCurrencyMoney(parsed.subtotal), x + 126, y + 36, { width: 96, align: 'right' });
    doc.text('Impuestos', x + 18, y + 56, { width: 90 });
    doc.text(this.formatCurrencyMoney(parsed.totalImpuestosTrasladados), x + 126, y + 56, { width: 96, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Total', x + 18, y + 76, { width: 90 });
    doc.text(this.formatCurrencyMoney(parsed.total), x + 126, y + 76, { width: 96, align: 'right' });
    doc.y = y + height + 12;
  }

  private drawComplementoHeaderReference(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument) {
    const leftX = 30;
    const topY = 30;
    const logo = this.loadBrandLogo();

    if (logo) {
      doc.image(logo, leftX, topY + 6, { fit: [260, 74] });
    }

    doc.fillColor('#4B5563').font('Helvetica-Bold').fontSize(10);
    doc.text(`RFC: ${parsed.emisor.rfc ?? 'N/D'}`, leftX + 4, topY + 78);
    doc.font('Helvetica').fontSize(9);
    doc.text(`Regimen Fiscal: ${parsed.emisor.regimenFiscal ?? 'N/D'}`, leftX + 4, topY + 96);
    doc.text(`Lugar de Expedicion (CP): ${parsed.lugarExpedicion ?? 'N/D'}`, leftX + 4, topY + 110);

    const boxX = 320;
    const boxY = topY;
    const boxWidth = 256;
    const boxHeight = 148;
    doc.save();
    doc.rect(boxX, boxY, boxWidth, boxHeight).fill('#F3F4F6');
    doc.rect(boxX, boxY, boxWidth, boxHeight).strokeColor('#D1D5DB').lineWidth(1).stroke();
    doc.restore();

    doc.fillColor('#4B5563').font('Helvetica-Bold').fontSize(14).text('COMPLEMENTO DE\nPAGO', boxX + 14, boxY + 12, {
      width: boxWidth - 20,
      align: 'right',
    });

    doc.fillColor('#374151').font('Helvetica-Bold').fontSize(9);
    doc.text('Serie/Folio:', boxX + 14, boxY + 46);
    doc.text('Fecha Emision:', boxX + 14, boxY + 62);
    doc.text('Folio Fiscal', boxX + 14, boxY + 78);
    doc.text('(UUID):', boxX + 14, boxY + 90);
    doc.text('No. Certificado:', boxX + 14, boxY + 106);
    doc.text('Tipo', boxX + 14, boxY + 122);
    doc.text('Comprobante:', boxX + 14, boxY + 134);

    doc.font('Helvetica').fontSize(9).fillColor('#111827');
    doc.text(this.buildFolio(parsed.serie, parsed.folio), boxX + 126, boxY + 46, { width: 112, align: 'right' });
    doc.text(parsed.fecha ?? 'N/D', boxX + 126, boxY + 62, { width: 112, align: 'right' });
    doc.text(parsed.timbre.uuid ?? 'N/D', boxX + 126, boxY + 78, { width: 112, align: 'right' });
    doc.text(parsed.noCertificado ?? 'N/D', boxX + 126, boxY + 106, { width: 112, align: 'right' });
    doc.text(this.formatTipoComprobante(parsed), boxX + 126, boxY + 122, { width: 112, align: 'right' });

    doc.y = topY + 160;
  }

  private drawComplementoReceiverAndPaymentCards(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument) {
    const pago = parsed.pagos[0];
    const startY = doc.y + 8;
    const leftX = 30;
    const rightX = 304;
    const cardWidth = 272;
    const cardHeight = 108;
    const headerColor = '#6B7280';

    this.drawPanelCard(doc, leftX, startY, cardWidth, cardHeight, 'DATOS DEL RECEPTOR', headerColor);
    this.drawPanelCard(doc, rightX, startY, cardWidth, cardHeight, 'DETALLES DEL PAGO RECIBIDO', headerColor);

    this.drawInlineField(doc, 'Nombre', parsed.receptor.nombre ?? 'N/D', leftX + 8, startY + 34, 248);
    this.drawInlineField(doc, 'RFC', parsed.receptor.rfc ?? 'N/D', leftX + 8, startY + 50, 248);
    this.drawInlineField(doc, 'Domicilio Fiscal CP', parsed.receptor.domicilioFiscal ?? 'N/D', leftX + 8, startY + 66, 248);
    this.drawInlineField(doc, 'Regimen Fiscal', parsed.receptor.regimenFiscal ?? 'N/D', leftX + 8, startY + 82, 248);
    this.drawInlineField(doc, 'Uso CFDI', parsed.receptor.usoCfdi ?? 'N/D', leftX + 8, startY + 98, 248);

    this.drawInlineField(doc, 'Fecha de Pago', pago?.fechaPago ?? 'N/D', rightX + 8, startY + 34, 248);
    this.drawInlineField(doc, 'Forma de Pago', pago?.formaDePagoP ?? 'N/D', rightX + 8, startY + 50, 248);
    this.drawInlineField(doc, 'Moneda de Pago', pago?.monedaP ?? 'N/D', rightX + 8, startY + 66, 248);
    this.drawInlineField(doc, 'Monto Recibido', this.formatCurrencyMoney(pago?.monto ?? 0), rightX + 8, startY + 82, 248);

    doc.y = startY + cardHeight + 18;
  }

  private drawComplementoDocumentsTable(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument) {
    const documents = parsed.pagos.flatMap((pago) => pago.doctosRelacionados.map((docto) => ({
      ...docto,
      pagoMonto: pago.monto,
    })));
    const titleY = doc.y;

    doc.save();
    doc.rect(30, titleY, 546, 26).fill('#6B7280');
    doc.restore();
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text(
      'DOCUMENTOS RELACIONADOS (FACTURAS PAGADAS)',
      40,
      titleY + 8,
      { width: 526 },
    );
    doc.y = titleY + 30;

    const columns = {
      uuid: 30,
      folio: 186,
      parcialidad: 262,
      saldoAnterior: 326,
      importePagado: 420,
      saldoInsoluto: 514,
    };

    const drawHeader = () => {
      const y = doc.y;
      doc.save();
      doc.rect(30, y, 546, 24).fill('#9CA3AF');
      doc.restore();
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
      doc.text('UUID Relacionado', columns.uuid + 6, y + 7, { width: 146 });
      doc.text('Folio', columns.folio + 6, y + 7, { width: 66 });
      doc.text('Parcialidad', columns.parcialidad + 6, y + 7, { width: 54 });
      doc.text('Saldo Anterior', columns.saldoAnterior + 6, y + 7, { width: 88 });
      doc.text('Importe Pagado', columns.importePagado + 6, y + 7, { width: 88 });
      doc.text('Saldo Insoluto', columns.saldoInsoluto + 6, y + 7, { width: 54 });
      doc.fillColor('#111827');
      doc.y = y + 24;
    };

    drawHeader();

    documents.forEach((docto, index) => {
      const y = doc.y;
      const uuidHeight = doc.heightOfString(docto.idDocumento ?? 'N/D', { width: 146 });
      const rowHeight = Math.max(24, uuidHeight + 8);
      this.ensurePdfSpace(doc, rowHeight + 26, drawHeader);

      doc.save();
      doc.rect(30, y, 546, rowHeight).fill(index % 2 === 0 ? '#F9FAFB' : '#FFFFFF');
      doc.restore();

      doc.font('Helvetica').fontSize(8.3).fillColor('#111827');
      doc.text(docto.idDocumento ?? 'N/D', columns.uuid + 6, y + 7, { width: 146 });
      doc.text(this.buildFolio(docto.serie, docto.folio), columns.folio + 6, y + 7, { width: 66 });
      doc.text(docto.numParcialidad ?? 'N/D', columns.parcialidad + 24, y + 7, { width: 30, align: 'center' });
      doc.text(this.formatCurrencyMoney(docto.impSaldoAnt), columns.saldoAnterior + 6, y + 7, { width: 84, align: 'right' });
      doc.text(this.formatCurrencyMoney(docto.impPagado), columns.importePagado + 6, y + 7, { width: 84, align: 'right' });
      doc.text(this.formatCurrencyMoney(docto.impSaldoInsoluto), columns.saldoInsoluto + 6, y + 7, { width: 52, align: 'right' });
      doc.y = y + rowHeight;
    });

    doc.y += 8;
  }

  private drawPdfHeader(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument) {
    const top = 24;
    const left = 36;
    const logo = this.loadBrandLogo();
    const cardX = 370;
    const cardY = top + 8;
    const cardWidth = 206;
    const cardHeight = 84;

    if (logo) {
      doc.image(logo, left + 16, top + 16, { fit: [250, 76] });
    }

    doc.save();
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 12).fill('#FFFFFF');
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 12).strokeColor('#D6E1EA').lineWidth(1).stroke();
    doc.restore();

    doc.fillColor('#0F2D52');
    doc.font('Helvetica-Bold').fontSize(12).text('FACTURA', cardX + 12, cardY + 10);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#6B7280').text('Serie/Folio', cardX + 12, cardY + 32);
    doc.fillColor('#111827').font('Helvetica').fontSize(9).text(
      this.buildFolio(parsed.serie, parsed.folio),
      cardX + 12,
      cardY + 43,
      { width: 94 },
    );
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#6B7280').text('Fecha', cardX + 108, cardY + 30);
    doc.fillColor('#111827').font('Helvetica').fontSize(9).text(
      this.formatIsoDate(parsed.fecha) ?? 'N/D',
      cardX + 108,
      cardY + 43,
      { width: 86 },
    );

    doc.fillColor('#111827');
    doc.y = top + 98;
  }

  private drawPartyBlocks(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument) {
    const startY = doc.y;
    const leftX = 36;
    const rightX = 315;
    const blockWidth = 245;
    const emisorNameHeight = doc.heightOfString(parsed.emisor.nombre ?? 'N/D', { width: blockWidth - 24 });
    const receptorNameHeight = doc.heightOfString(parsed.receptor.nombre ?? 'N/D', { width: blockWidth - 24 });
    const nameHeight = Math.max(emisorNameHeight, receptorNameHeight, 14);
    const cardHeight = Math.max(108, 92 + nameHeight);

    this.drawInfoCard(doc, leftX, startY, blockWidth, cardHeight, 'EMISOR', '#EAF2FB');
    this.drawInfoCard(doc, rightX, startY, blockWidth, cardHeight, 'Receptor', '#EEF7EF');

    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10);
    doc.text(parsed.emisor.nombre ?? 'N/D', leftX + 12, startY + 28, { width: blockWidth - 24 });
    doc.font('Helvetica').fontSize(9);
    let currentY = startY + 28 + emisorNameHeight + 6;
    doc.text(`RFC: ${parsed.emisor.rfc ?? 'N/D'}`, leftX + 12, currentY, { width: blockWidth - 24 });
    currentY += 14;
    doc.text(`Regimen fiscal: ${parsed.emisor.regimenFiscal ?? 'N/D'}`, leftX + 12, currentY, { width: blockWidth - 24 });

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(parsed.receptor.nombre ?? 'N/D', rightX + 12, startY + 28, { width: blockWidth - 24 });
    doc.font('Helvetica').fontSize(9);
    currentY = startY + 28 + receptorNameHeight + 6;
    doc.text(`RFC: ${parsed.receptor.rfc ?? 'N/D'}`, rightX + 12, currentY, { width: blockWidth - 24 });
    currentY += 14;
    doc.text(`Uso CFDI: ${parsed.receptor.usoCfdi ?? 'N/D'}`, rightX + 12, currentY, { width: blockWidth - 24 });
    currentY += 14;
    doc.text(`Domicilio fiscal: ${parsed.receptor.domicilioFiscal ?? 'N/D'}`, rightX + 12, currentY, {
      width: blockWidth - 24,
    });
    currentY += 14;
    doc.text(`Regimen fiscal: ${parsed.receptor.regimenFiscal ?? 'N/D'}`, rightX + 12, currentY, {
      width: blockWidth - 24,
    });

    doc.y = startY + cardHeight + 12;
  }

  private drawMetadataBlock(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument) {
    const startY = doc.y;
    const left = 36;
    const width = 540;
    const cardHeight = 154;

    this.drawInfoCard(doc, left, startY, width, cardHeight, 'Datos fiscales', '#F8FAFC');

    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9);
    doc.text('Tipo de comprobante:', left + 18, startY + 30, { width: 120 });
    doc.text('Forma de pago:', left + 280, startY + 30, { width: 120 });
    doc.text('Moneda:', left + 18, startY + 54, { width: 120 });
    doc.text('Metodo de pago:', left + 280, startY + 54, { width: 120 });
    doc.text('Uso del CFDI:', left + 18, startY + 78, { width: 120 });
    doc.text('Lugar expedicion:', left + 280, startY + 78, { width: 120 });

    doc.font('Helvetica').fontSize(9);
    doc.text(parsed.tipoDeComprobante ?? 'N/D', left + 142, startY + 30, { width: 120 });
    doc.text(parsed.formaPago ?? 'N/D', left + 402, startY + 30, { width: 120 });
    doc.text(parsed.moneda ?? 'N/D', left + 142, startY + 54, { width: 120 });
    doc.text(parsed.metodoPago ?? 'N/D', left + 402, startY + 54, { width: 120 });
    doc.text(parsed.receptor.usoCfdi ?? 'N/D', left + 142, startY + 78, { width: 120 });
    doc.text(parsed.lugarExpedicion ?? 'N/D', left + 402, startY + 78, { width: 120 });

    const footerY = startY + 106;
    doc.save();
    doc.rect(left + 12, footerY, width - 24, 18).fill('#E5E7EB');
    doc.restore();
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9);
    doc.text('Folio Fiscal', left + 18, footerY + 4, { width: 140 });
    doc.text('Certificado Digital SAT', left + 188, footerY + 4, { width: 160 });
    doc.text('Fecha de certificacion', left + 418, footerY + 4, { width: 130 });

    doc.font('Helvetica').fontSize(8.5);
    doc.text(parsed.timbre.uuid ?? 'N/D', left + 18, footerY + 22, { width: 150 });
    doc.text(parsed.timbre.noCertificadoSat ?? 'N/D', left + 188, footerY + 22, { width: 170 });
    doc.text(this.formatIsoDate(parsed.timbre.fechaTimbrado) ?? 'N/D', left + 418, footerY + 22, { width: 120 });

    doc.y = startY + cardHeight + 10;
  }

  private drawInvoiceConceptsTable(doc: PDFKit.PDFDocument, conceptos: ParsedInvoiceConcept[]) {
    const columns = {
      claveSat: 36,
      noIdentif: 98,
      unidad: 164,
      descripcion: 230,
      cantidad: 426,
      unitario: 466,
      importe: 522,
    };

    const drawHeader = () => {
      const y = doc.y;
      doc.save();
      doc.roundedRect(36, y, 540, 22, 6).fill('#15467F');
      doc.restore();
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
      doc.text('Clave SAT', columns.claveSat + 6, y + 7, { width: 56 });
      doc.text('No. Identif', columns.noIdentif + 6, y + 7, { width: 60 });
      doc.text('Unidad', columns.unidad + 6, y + 7, { width: 54 });
      doc.text('Descripcion', columns.descripcion + 6, y + 7, { width: 160 });
      doc.text('Cant.', columns.cantidad, y + 7, { width: 36, align: 'right' });
      doc.text('Unitario', columns.unitario, y + 7, { width: 50, align: 'right' });
      doc.text('Importe', columns.importe, y + 7, { width: 56, align: 'right' });
      doc.fillColor('#111827');
      doc.y = y + 28;
    };

    drawHeader();

    conceptos.forEach((concepto, index) => {
      const description = concepto.descripcion ?? 'N/D';
      const unidadCompuesta = `${concepto.claveUnidad ?? 'N/D'}\n${concepto.unidad ?? 'N/D'}`;
      const rowHeight = Math.max(
        30,
        Math.max(
          doc.heightOfString(description, { width: 162, align: 'left' }) + 10,
          doc.heightOfString(unidadCompuesta, { width: 54, align: 'left' }) + 10,
        ),
      );
      this.ensurePdfSpace(doc, rowHeight + 24, drawHeader);

      const rowY = doc.y;
      doc.save();
      doc.roundedRect(36, rowY, 540, rowHeight, 6).fill(index % 2 === 0 ? '#F8FAFC' : '#FFFFFF');
      doc.restore();

      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8.5);
      doc.text(concepto.claveProdServ ?? 'N/D', columns.claveSat + 6, rowY + 7, { width: 56 });
      doc.text(concepto.noIdentificacion ?? 'N/D', columns.noIdentif + 6, rowY + 7, { width: 60 });
      doc.font('Helvetica').fontSize(7.5);
      doc.text(unidadCompuesta, columns.unidad + 6, rowY + 7, { width: 54 });
      doc.font('Helvetica').fontSize(8);
      doc.text(description, columns.descripcion + 6, rowY + 7, { width: 162 });
      doc.text(this.formatQuantity(concepto.cantidad), columns.cantidad, rowY + 7, { width: 36, align: 'right' });
      doc.text(this.formatCurrencyMoney(concepto.valorUnitario), columns.unitario, rowY + 7, { width: 50, align: 'right' });
      doc.text(this.formatCurrencyMoney(concepto.importe), columns.importe, rowY + 7, { width: 56, align: 'right' });
      doc.y = rowY + rowHeight + 4;
    });

    doc.y += 4;
  }

  private drawInvoiceTotals(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument) {
    this.ensurePdfSpace(doc, 104);
    const startY = doc.y;

    doc.save();
    doc.roundedRect(340, startY, 236, 92, 12).fill('#FFFFFF');
    doc.roundedRect(340, startY, 236, 92, 12).strokeColor('#D6E1EA').lineWidth(1).stroke();
    doc.restore();

    doc.font('Helvetica').fontSize(10).fillColor('#111827');
    doc.text(`Subtotal`, 356, startY + 22, { width: 90 });
    doc.text(this.formatCurrencyMoney(parsed.subtotal), 438, startY + 22, { width: 118, align: 'right' });
    doc.text(`Impuestos`, 356, startY + 44, { width: 90 });
    doc.text(this.formatCurrencyMoney(parsed.totalImpuestosTrasladados), 438, startY + 44, { width: 118, align: 'right' });
    doc.font('Helvetica-Bold').fillColor('#0F172A');
    doc.text(`Total`, 356, startY + 66, { width: 90 });
    doc.text(this.formatCurrencyMoney(parsed.total), 438, startY + 66, { width: 118, align: 'right' });

    doc.fillColor('#111827');
    doc.y = startY + 104;
  }

  private drawPaymentBlocks(doc: PDFKit.PDFDocument, pagos: ParsedPaymentEntry[]) {
    this.drawSectionTitle(doc, 'Detalle de pagos');
    doc.moveDown(0.2);

    for (const pago of pagos) {
      this.ensurePdfSpace(doc, 140);
      const blockStart = doc.y;
      const baseHeight = 48 + pago.doctosRelacionados.length * 42;
      doc.save();
      doc.roundedRect(36, blockStart, 540, baseHeight, 12).fill('#F8FAFC');
      doc.roundedRect(36, blockStart, 540, 28, 12).fill('#15467F');
      doc.restore();

      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text(
        `Pago ${this.formatIsoDate(pago.fechaPago) ?? 'N/D'}  |  Forma: ${pago.formaDePagoP ?? 'N/D'}  |  Monto: ${this.formatMoney(pago.monto)}`,
        48,
        blockStart + 9,
        { width: 516 },
      );

      let currentY = blockStart + 38;

      for (const docto of pago.doctosRelacionados) {
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9);
        doc.text(
          `Documento: ${this.buildFolio(docto.serie, docto.folio)}  |  Parcialidad: ${docto.numParcialidad ?? 'N/D'}`,
          48,
          currentY,
          { width: 500 },
        );
        doc.font('Helvetica').fontSize(8.5);
        doc.text(`UUID relacionado: ${docto.idDocumento ?? 'N/D'}`, 48, currentY + 13, { width: 500 });
        doc.text(
          `Saldo anterior: ${this.formatMoney(docto.impSaldoAnt)}  |  Pagado: ${this.formatMoney(docto.impPagado)}  |  Insoluto: ${this.formatMoney(docto.impSaldoInsoluto)}`,
          48,
          currentY + 25,
          { width: 500 },
        );
        currentY += 40;
      }

      doc.y = blockStart + baseHeight + 10;
      doc.fillColor('#111827');
    }
  }

  private drawPaymentTotals(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument) {
    this.ensurePdfSpace(doc, 84);
    const startY = doc.y;
    doc.save();
    doc.roundedRect(36, startY, 540, 70, 12).fill('#EEF7EF');
    doc.restore();

    doc.fillColor('#14532D').font('Helvetica-Bold').fontSize(12).text('Totales del complemento', 48, startY + 12);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Monto total de pagos: ${this.formatMoney(parsed.totalMontoPagos)}`, 48, startY + 34);
    doc.text(`Total CFDI: ${this.formatMoney(parsed.total)}`, 320, startY + 34);
    doc.fillColor('#111827');
    doc.y = startY + 84;
  }

  private drawTimbreBlock(doc: PDFKit.PDFDocument, parsed: ParsedCfdiDocument, qrBuffer: Buffer | null) {
    const isComplemento = (parsed.tipoDeComprobante ?? '').trim().toUpperCase() === 'P';
    const blockX = isComplemento ? 30 : 24;
    const blockWidth = isComplemento ? 546 : 552;
    const contentX = blockX + 12;
    const qrWidth = qrBuffer ? 82 : 0;
    const metaX = qrBuffer ? contentX + 96 : contentX;
    const metaWidth = blockWidth - 24 - (qrBuffer ? 96 : 0);
    const selloWidth = blockWidth - 24;
    doc.font('Helvetica').fontSize(8);
    const selloCfdHeight = doc.heightOfString(parsed.timbre.selloCfd ?? 'N/D', { width: selloWidth });
    const selloSatHeight = doc.heightOfString(parsed.timbre.selloSat ?? 'N/D', { width: selloWidth });
    const topSectionHeight = qrBuffer ? 96 : 62;
    const blockHeight = 40 + topSectionHeight + selloCfdHeight + selloSatHeight + 30;
    const headerColor = isComplemento ? '#6B7280' : '#2F4EA2';
    const title = 'TIMBRE FISCAL DIGITAL';

    this.ensurePdfSpace(doc, blockHeight + 16);
    const startY = doc.y;

    this.drawPanelCard(doc, blockX, startY, blockWidth, blockHeight, title, headerColor);

    doc.fillColor('#111827').font('Helvetica').fontSize(9);

    if (qrBuffer) {
      doc.image(qrBuffer, contentX, startY + 38, { fit: [qrWidth, qrWidth] });
    }

    doc.text(`UUID: ${parsed.timbre.uuid ?? 'N/D'}`, metaX, startY + 38, { width: metaWidth });
    doc.text(`Fecha de timbrado: ${this.formatIsoDate(parsed.timbre.fechaTimbrado) ?? 'N/D'}`, metaX, startY + 54, {
      width: metaWidth,
    });
    doc.text(`No. certificado SAT: ${parsed.timbre.noCertificadoSat ?? 'N/D'}`, metaX, startY + 70, {
      width: metaWidth,
    });
    doc.text(`RFC PAC: ${parsed.timbre.rfcProvCertif ?? 'N/D'}`, metaX, startY + 86, { width: metaWidth });

    let currentY = startY + 38 + topSectionHeight;
    currentY = this.drawMultilineTextAt(doc, 'Sello CFD', parsed.timbre.selloCfd, contentX, currentY, selloWidth);
    currentY = this.drawMultilineTextAt(doc, 'Sello SAT', parsed.timbre.selloSat, contentX, currentY + 4, selloWidth);

    doc.fillColor('#111827');
    doc.y = Math.max(currentY + 8, startY + blockHeight + 8);
  }

  private drawMultilineText(doc: PDFKit.PDFDocument, label: string, value: string | null) {
    if (!value) {
      doc.text(`${label}: N/D`);
      return;
    }

    doc.font('Helvetica-Bold').text(`${label}:`, { continued: false });
    doc.font('Helvetica').text(value, {
      width: 516,
    });
  }

  private drawMultilineTextAt(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string | null,
    x: number,
    y: number,
    width: number,
  ) {
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text(`${label}:`, x, y, { width });
    const textY = doc.y + 2;
    doc.font('Helvetica').fontSize(8).text(value ?? 'N/D', x, textY, { width });
    return doc.y;
  }

  private drawSeparator(doc: PDFKit.PDFDocument) {
    const y = doc.y + 4;
    doc.moveTo(36, y).lineTo(576, y).strokeColor('#D9D9D9').lineWidth(1).stroke();
    doc.moveDown(0.8);
  }

  private drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    const y = doc.y;
    doc.save();
    doc.roundedRect(36, y, 540, 24, 8).fill('#EAF2FB');
    doc.restore();
    doc.fillColor('#0F2D52').font('Helvetica-Bold').fontSize(11).text(title, 48, y + 7);
    doc.fillColor('#111827');
    doc.y = y + 30;
  }

  private drawInfoCard(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    headerColor: string,
  ) {
    doc.save();
    doc.roundedRect(x, y, width, height, 12).fill('#FFFFFF');
    doc.roundedRect(x, y, width, height, 12).strokeColor('#D6E1EA').lineWidth(1).stroke();
    doc.restore();

    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10).text(title, x + 12, y + 7);
    doc.fillColor('#111827');
  }

  private drawPanelCard(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    headerColor: string,
  ) {
    doc.save();
    doc.roundedRect(x, y, width, height, 4).fill('#FFFFFF');
    doc.roundedRect(x, y, width, height, 4).strokeColor('#D1D5DB').lineWidth(1).stroke();
    doc.rect(x, y, width, 24).fill(headerColor);
    doc.restore();

    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text(title, x + 8, y + 7);
    doc.fillColor('#111827');
  }

  private drawInlineField(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
  ) {
    doc.font('Helvetica-Bold').fontSize(8.8).fillColor('#374151').text(`${label}:`, x, y, {
      width,
      continued: true,
    });
    doc.font('Helvetica').fillColor('#111827').text(` ${value}`, {
      width,
    });
  }

  private formatTipoComprobante(parsed: ParsedCfdiDocument) {
    const tipo = (parsed.tipoDeComprobante ?? '').trim().toUpperCase();
    switch (tipo) {
      case 'I':
        return 'I (Ingreso)';
      case 'P':
        return 'P (Pago)';
      case 'E':
        return 'E (Egreso)';
      default:
        return parsed.tipoDeComprobante ?? 'N/D';
    }
  }

  private ensurePdfSpace(doc: PDFKit.PDFDocument, height: number, onNewPage?: () => void) {
    const limit = doc.page.height - doc.page.margins.bottom - height;
    if (doc.y <= limit) {
      return;
    }

    doc.addPage();
    if (onNewPage) {
      onNewPage();
    }
  }

  private generateSatQrPng(qrUrl: string): Promise<Buffer> {
    return bwipjs.toBuffer({
      bcid: 'qrcode',
      text: qrUrl,
      scale: 3,
      paddingwidth: 2,
      paddingheight: 2,
      includetext: false,
    });
  }

  private parseCfdiXml(xml: string): ParsedCfdiDocument {
    const sanitized = this.sanitizeXml(xml);
    const comprobante = this.parseTagAttributes(sanitized, 'Comprobante');
    const emisor = this.parseTagAttributes(sanitized, 'Emisor');
    const receptor = this.parseTagAttributes(sanitized, 'Receptor');
    const timbre = this.parseTagAttributes(sanitized, 'TimbreFiscalDigital');
    const conceptos = this.parseInvoiceConcepts(sanitized);
    const pagos = this.parsePaymentEntries(sanitized);
    const total = this.toNumber(comprobante.Total);
    const sello = this.cleanNullableString(comprobante.Sello);

    return {
      tipoDeComprobante: this.cleanNullableString(comprobante.TipoDeComprobante),
      version: this.cleanNullableString(comprobante.Version),
      serie: this.cleanNullableString(comprobante.Serie),
      folio: this.cleanNullableString(comprobante.Folio),
      fecha: this.cleanNullableString(comprobante.Fecha),
      subtotal: this.toNumber(comprobante.SubTotal),
      total,
      moneda: this.cleanNullableString(comprobante.Moneda),
      formaPago: this.cleanNullableString(comprobante.FormaPago),
      metodoPago: this.cleanNullableString(comprobante.MetodoPago),
      exportacion: this.cleanNullableString(comprobante.Exportacion),
      lugarExpedicion: this.cleanNullableString(comprobante.LugarExpedicion),
      noCertificado: this.cleanNullableString(comprobante.NoCertificado),
      sello,
      emisor: {
        rfc: this.cleanNullableString(emisor.Rfc),
        nombre: this.cleanNullableString(emisor.Nombre),
        regimenFiscal: this.cleanNullableString(emisor.RegimenFiscal),
        domicilioFiscal: null,
        usoCfdi: null,
      },
      receptor: {
        rfc: this.cleanNullableString(receptor.Rfc),
        nombre: this.cleanNullableString(receptor.Nombre),
        regimenFiscal: this.cleanNullableString(receptor.RegimenFiscalReceptor),
        domicilioFiscal: this.cleanNullableString(receptor.DomicilioFiscalReceptor),
        usoCfdi: this.cleanNullableString(receptor.UsoCFDI),
      },
      timbre: {
        uuid: this.cleanNullableString(timbre.UUID),
        fechaTimbrado: this.cleanNullableString(timbre.FechaTimbrado),
        noCertificadoSat: this.cleanNullableString(timbre.NoCertificadoSAT),
        selloCfd: this.cleanNullableString(timbre.SelloCFD),
        selloSat: this.cleanNullableString(timbre.SelloSAT),
        rfcProvCertif: this.cleanNullableString(timbre.RfcProvCertif),
      },
      conceptos,
      totalImpuestosTrasladados: this.resolveTotalImpuestosTrasladados(sanitized),
      pagos,
      totalMontoPagos: this.resolveMontoTotalPagos(sanitized),
      qrUrl: this.buildSatQrUrl({
        uuid: this.cleanNullableString(timbre.UUID),
        rfcEmisor: this.cleanNullableString(emisor.Rfc),
        rfcReceptor: this.cleanNullableString(receptor.Rfc),
        total,
        sello,
      }),
    };
  }

  private parseInvoiceConcepts(xml: string): ParsedInvoiceConcept[] {
    return this.extractTagBlocks(xml, 'Concepto').map(({ attrs, innerXml }) => {
      const traslados = this.extractTagBlocks(innerXml, 'Traslado');
      const impuestoImporte = traslados.reduce((acc, traslado) => acc + this.toNumber(traslado.attrs.Importe), 0);

      return {
        claveProdServ: this.cleanNullableString(attrs.ClaveProdServ),
        noIdentificacion: this.cleanNullableString(attrs.NoIdentificacion),
        cantidad: this.toNumber(attrs.Cantidad),
        claveUnidad: this.cleanNullableString(attrs.ClaveUnidad),
        unidad: this.cleanNullableString(attrs.Unidad),
        descripcion: this.cleanNullableString(attrs.Descripcion),
        valorUnitario: this.toNumber(attrs.ValorUnitario),
        importe: this.toNumber(attrs.Importe),
        impuestoImporte,
      };
    });
  }

  private parsePaymentEntries(xml: string): ParsedPaymentEntry[] {
    return this.extractTagBlocks(xml, 'Pago').map(({ attrs, innerXml }) => ({
      fechaPago: this.cleanNullableString(attrs.FechaPago),
      formaDePagoP: this.cleanNullableString(attrs.FormaDePagoP),
      monedaP: this.cleanNullableString(attrs.MonedaP),
      tipoCambioP: this.cleanNullableString(attrs.TipoCambioP),
      monto: this.toNumber(attrs.Monto),
      doctosRelacionados: this.extractTagBlocks(innerXml, 'DoctoRelacionado').map(({ attrs: doctoAttrs, innerXml: doctoInner }) => {
        const trasladosDr = this.extractTagBlocks(doctoInner, 'TrasladoDR');
        return {
          idDocumento: this.cleanNullableString(doctoAttrs.IdDocumento),
          serie: this.cleanNullableString(doctoAttrs.Serie),
          folio: this.cleanNullableString(doctoAttrs.Folio),
          numParcialidad: this.cleanNullableString(doctoAttrs.NumParcialidad),
          impSaldoAnt: this.toNumber(doctoAttrs.ImpSaldoAnt),
          impPagado: this.toNumber(doctoAttrs.ImpPagado),
          impSaldoInsoluto: this.toNumber(doctoAttrs.ImpSaldoInsoluto),
          impuestoImporte: trasladosDr.reduce((acc, traslado) => acc + this.toNumber(traslado.attrs.ImporteDR), 0),
        };
      }),
    }));
  }

  private resolveTotalImpuestosTrasladados(xml: string) {
    const bloquesImpuestos = this.extractTagBlocks(xml, 'Impuestos');
    const bloqueComprobante = bloquesImpuestos.find((bloque) => bloque.attrs.TotalImpuestosTrasladados !== undefined);
    if (bloqueComprobante?.attrs.TotalImpuestosTrasladados !== undefined) {
      return this.toNumber(bloqueComprobante.attrs.TotalImpuestosTrasladados);
    }

    return this.extractTagBlocks(xml, 'Traslado').reduce((acc, traslado) => acc + this.toNumber(traslado.attrs.Importe), 0);
  }

  private resolveMontoTotalPagos(xml: string) {
    const totales = this.parseTagAttributes(xml, 'Totales');
    return this.toNumber(totales.MontoTotalPagos);
  }

  private sanitizeXml(xml: string) {
    return xml
      .replace(/`/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r/g, '')
      .trim();
  }

  private parseTagAttributes(xml: string, tagName: string): Record<string, string> {
    const tag = this.extractFirstTag(xml, tagName);
    return tag ? this.parseAttributes(tag) : {};
  }

  private extractFirstTag(xml: string, tagName: string) {
    const regex = new RegExp(`<(?:(?:[\\w-]+):)?${tagName}\\b([^>]*?)(?:\\/?>)`, 'i');
    const match = xml.match(regex);
    return match?.[1] ?? null;
  }

  private extractTagBlocks(xml: string, tagName: string) {
    const regex = new RegExp(
      `<(?:(?:[\\w-]+):)?${tagName}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/(?:(?:[\\w-]+):)?${tagName}>)`,
      'gi',
    );

    return Array.from(xml.matchAll(regex)).map((match) => ({
      attrs: this.parseAttributes(match[1] ?? ''),
      innerXml: match[2] ?? '',
    }));
  }

  private parseAttributes(input: string) {
    const attrs: Record<string, string> = {};
    const regex = /([A-Za-z_][\w:.-]*)="([^"]*)"/g;

    for (const match of input.matchAll(regex)) {
      const rawKey = match[1] ?? '';
      const key = rawKey.includes(':') ? rawKey.split(':').pop() ?? rawKey : rawKey;
      attrs[key] = this.decodeXmlEntities(match[2] ?? '');
    }

    return attrs;
  }

  private decodeXmlEntities(value: string) {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  private buildSatQrUrl(input: {
    uuid: string | null;
    rfcEmisor: string | null;
    rfcReceptor: string | null;
    total: number;
    sello: string | null;
  }) {
    const { uuid, rfcEmisor, rfcReceptor, total, sello } = input;
    if (!uuid || !rfcEmisor || !rfcReceptor || !sello) {
      return null;
    }

    const totalFormatted = this.toNumber(total).toFixed(6);
    const fe = sello.slice(-8);
    return `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${encodeURIComponent(uuid)}&re=${encodeURIComponent(rfcEmisor)}&rr=${encodeURIComponent(rfcReceptor)}&tt=${encodeURIComponent(totalFormatted)}&fe=${encodeURIComponent(fe)}`;
  }

  private formatIsoDate(value: string | null) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  private formatQuantity(value: number) {
    return value.toLocaleString('es-MX', {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 3,
    });
  }

  private buildComplementoFileName(complemento: CompagLegacy, cfd: CfdLegacy | null) {
    const base = cfd
      ? this.buildFolio(cfd.serie, cfd.folio)
      : this.buildFolio(complemento.cpSerie, complemento.cpFolio);

    return base.replace(/[^a-zA-Z0-9-_]+/g, '_');
  }

  private cleanNullableString(value: string | null | undefined) {
    const cleanValue = `${value ?? ''}`.trim();
    return cleanValue ? cleanValue : null;
  }

  private formatNullableDate(value: Date | string | null | undefined) {
    if (!value) {
      return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      return null;
    }

    return this.formatDate(parsed);
  }

  private formatNullableDateTime(value: Date | string | null | undefined) {
    if (!value) {
      return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString();
  }

  private formatDate(value: Date) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toNumber(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private toMoney(value: string | number | null | undefined) {
    return Number(this.toNumber(value).toFixed(2));
  }

  private formatMoney(value: string | number | null | undefined) {
    return this.toMoney(value).toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private formatCurrencyMoney(value: string | number | null | undefined) {
    return `$${this.formatMoney(value)}`;
  }
}
