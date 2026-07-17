import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';

export type ThermalLabelType = 'bulto' | 'producto';
export type ZplMeasureUnit = 'mm' | 'cm' | 'in';

@Injectable()
export class ThermalLabelsAlmacenService {
  private static readonly PACKAGE_LABEL_SIZE: [number, number] = [283.46, 425.2];
  private static readonly PRODUCT_LABEL_SIZE: [number, number] = [141.75, 85.05];
  private static readonly PRODUCT_GRID_COLUMNS = 2;
  private static readonly PRODUCT_GRID_ROWS = 5;
  private static readonly PRODUCT_CELL_PADDING = {
    left: 0.06,
    right: 0.06,
    top: 0.05,
    bottom: 0.08,
  };
  private static readonly SUPPORTED_TYPES: ThermalLabelType[] = ['bulto', 'producto'];
  private static readonly SUPPORTED_ZPL_UNITS: ZplMeasureUnit[] = ['mm', 'cm', 'in'];
  private static readonly LABELARY_DPMM = 8;
  private static readonly LABELARY_MAX_LABELS_PER_REQUEST = 40;
  private static readonly LABELARY_MAX_BODY_BYTES = 900 * 1024;
  private static readonly LABELARY_BASE_URL = 'https://api.labelary.com/v1/printers';

  async adaptPdf(inputPdfBytes: Buffer | Uint8Array, labelType: ThermalLabelType): Promise<Uint8Array> {
    const sourceBytes = inputPdfBytes instanceof Uint8Array ? inputPdfBytes : new Uint8Array(inputPdfBytes);
    const sourcePdf = await PDFDocument.load(sourceBytes);
    const targetPdf = await PDFDocument.create();

    if (labelType === 'bulto') {
      await this.transformPackageLabels(sourcePdf, targetPdf);
    } else {
      await this.transformProductLabels(sourcePdf, targetPdf);
    }

    return targetPdf.save();
  }

  async convertZplToPdf(
    inputZplBytes: Buffer | Uint8Array,
    width: number,
    height: number,
    unit: ZplMeasureUnit,
  ): Promise<Uint8Array> {
    const normalizedZpl = this.normalizeZplInput(inputZplBytes);

    if (!normalizedZpl) {
      throw new BadRequestException('El archivo TXT no contiene codigo ZPL.');
    }

    const zplExpandido = this.expandirCantidadesZPL(normalizedZpl);
    const bloques = this.extractZplBlocks(zplExpandido);

    if (!bloques.length) {
      throw new BadRequestException('No se encontraron etiquetas ZPL validas entre ^XA y ^XZ.');
    }

    const widthInches = this.convertToInches(width, unit);
    const heightInches = this.convertToInches(height, unit);
    const lotes = this.createLabelaryChunks(bloques);

    const pdfsPorLote: Uint8Array[] = [];
    for (const lote of lotes) {
      pdfsPorLote.push(await this.renderChunkWithLabelary(lote, widthInches, heightInches));
    }

    return this.mergePdfDocuments(pdfsPorLote);
  }

  isSupportedLabelType(value: string): value is ThermalLabelType {
    return ThermalLabelsAlmacenService.SUPPORTED_TYPES.includes(value as ThermalLabelType);
  }

  isSupportedZplUnit(value: string): value is ZplMeasureUnit {
    return ThermalLabelsAlmacenService.SUPPORTED_ZPL_UNITS.includes(value as ZplMeasureUnit);
  }

  getDownloadFileName(originalFileName: string, labelType: ThermalLabelType) {
    const safeBaseName = originalFileName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9-_]+/g, '_');
    return `${safeBaseName}_${labelType}_termico.pdf`;
  }

  getZplDownloadFileName(originalFileName: string) {
    const safeBaseName = originalFileName.replace(/\.(txt|zpl)$/i, '').replace(/[^a-zA-Z0-9-_]+/g, '_');
    return `${safeBaseName}_zpl.pdf`;
  }

  private async transformPackageLabels(sourcePdf: PDFDocument, targetPdf: PDFDocument) {
    for (const page of sourcePdf.getPages()) {
      const embeddedPage = await targetPdf.embedPage(page);
      const newPage = targetPdf.addPage(ThermalLabelsAlmacenService.PACKAGE_LABEL_SIZE);

      newPage.drawPage(embeddedPage, {
        x: -29,
        y: -145,
        xScale: 1,
        yScale: 1,
      });
    }
  }

  private async transformProductLabels(sourcePdf: PDFDocument, targetPdf: PDFDocument) {
    const [targetWidth, targetHeight] = ThermalLabelsAlmacenService.PRODUCT_LABEL_SIZE;
    const columns = ThermalLabelsAlmacenService.PRODUCT_GRID_COLUMNS;
    const rows = ThermalLabelsAlmacenService.PRODUCT_GRID_ROWS;
    const padding = ThermalLabelsAlmacenService.PRODUCT_CELL_PADDING;

    for (const page of sourcePdf.getPages()) {
      const originalWidth = page.getWidth();
      const originalHeight = page.getHeight();
      const cellWidth = originalWidth / columns;
      const cellHeight = originalHeight / rows;

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const rawLeft = column * cellWidth;
          const rawRight = rawLeft + cellWidth;
          const rawTop = originalHeight - row * cellHeight;
          const rawBottom = rawTop - cellHeight;

          const left = rawLeft + cellWidth * padding.left;
          const right = rawRight - cellWidth * padding.right;
          const top = rawTop - cellHeight * padding.top;
          const bottom = rawBottom + cellHeight * padding.bottom;

          const embeddedCell = await targetPdf.embedPage(page, {
            left,
            right,
            bottom,
            top,
          });

          const scale = Math.min(
            targetWidth / embeddedCell.width,
            targetHeight / embeddedCell.height,
          ) * 0.96;

          const drawWidth = embeddedCell.width * scale;
          const drawHeight = embeddedCell.height * scale;
          const offsetX = (targetWidth - drawWidth) / 2;
          const offsetY = (targetHeight - drawHeight) / 2;

          const newPage = targetPdf.addPage([targetWidth, targetHeight]);
          newPage.drawPage(embeddedCell, {
            x: offsetX,
            y: offsetY,
            xScale: scale,
            yScale: scale,
          });
        }
      }
    }
  }

  private normalizeZplInput(inputZplBytes: Buffer | Uint8Array) {
    const zpl = Buffer.from(inputZplBytes).toString('utf-8');
    return zpl.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  }

  private convertToInches(value: number, unit: ZplMeasureUnit) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('Las medidas deben ser numeros mayores a 0.');
    }

    switch (unit) {
      case 'mm':
        return value / 25.4;
      case 'cm':
        return value / 2.54;
      case 'in':
        return value;
      default:
        throw new BadRequestException('La unidad debe ser mm, cm o in.');
    }
  }

  private createLabelaryChunks(blocks: string[]) {
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentBytes = 0;

    for (const block of blocks) {
      const normalizedBlock = block.trim();
      if (!normalizedBlock) {
        continue;
      }

      const blockBytes = Buffer.byteLength(normalizedBlock, 'utf8');
      if (blockBytes > ThermalLabelsAlmacenService.LABELARY_MAX_BODY_BYTES) {
        throw new BadRequestException(
          'Una etiqueta individual excede el limite de tamano permitido por Labelary.',
        );
      }

      const separatorBytes = currentChunk.length > 0 ? 1 : 0;
      const wouldExceedBody =
        currentBytes + separatorBytes + blockBytes > ThermalLabelsAlmacenService.LABELARY_MAX_BODY_BYTES;
      const wouldExceedLabels =
        currentChunk.length >= ThermalLabelsAlmacenService.LABELARY_MAX_LABELS_PER_REQUEST;

      if (currentChunk.length > 0 && (wouldExceedBody || wouldExceedLabels)) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentBytes = 0;
      }

      currentChunk.push(normalizedBlock);
      currentBytes += (currentChunk.length > 1 ? 1 : 0) + blockBytes;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }

  private async renderChunkWithLabelary(chunkZpl: string, widthInches: number, heightInches: number) {
    const width = this.formatMeasureForUrl(widthInches);
    const height = this.formatMeasureForUrl(heightInches);
    // Para PDF, omitir el index hace que Labelary devuelva todas las etiquetas del lote.
    const url = `${ThermalLabelsAlmacenService.LABELARY_BASE_URL}/${ThermalLabelsAlmacenService.LABELARY_DPMM}dpmm/labels/${width}x${height}/`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/pdf',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: chunkZpl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(`No fue posible conectar con Labelary: ${message}`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new BadRequestException(
        `Labelary rechazo el lote (${response.status}): ${errorText || 'Sin detalle adicional'}`,
      );
    }

    const pdfBytes = await response.arrayBuffer();
    return new Uint8Array(pdfBytes);
  }

  private async mergePdfDocuments(pdfDocuments: Array<Buffer | Uint8Array>) {
    if (pdfDocuments.length === 1) {
      return pdfDocuments[0] instanceof Uint8Array ? pdfDocuments[0] : new Uint8Array(pdfDocuments[0]);
    }

    const mergedPdf = await PDFDocument.create();

    for (const pdfDocument of pdfDocuments) {
      const sourceBytes = pdfDocument instanceof Uint8Array ? pdfDocument : new Uint8Array(pdfDocument);
      const sourcePdf = await PDFDocument.load(sourceBytes);
      const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

      for (const page of copiedPages) {
        mergedPdf.addPage(page);
      }
    }

    return mergedPdf.save();
  }

  private formatMeasureForUrl(value: number) {
    return value.toFixed(4).replace(/\.?0+$/, '');
  }

  private extractZplBlocks(zpl: string) {
    return zpl.match(/\^XA[\s\S]*?\^XZ/g) ?? [];
  }

  /**
   * Helper para interceptar etiquetas que traen el comando ^PQ (Print Quantity).
   * Si una etiqueta dice ^PQ76, la duplica 76 veces en el texto.
   */
  private expandirCantidadesZPL(zpl: string): string {
    const bloques = this.extractZplBlocks(zpl);
    if (!bloques.length) {
      return zpl;
    }

    let zplExpandido = '';

    for (const bloque of bloques) {
      const match = bloque.match(/\^PQ\s*(\d+)/i);
      if (!match) {
        zplExpandido += bloque;
        continue;
      }

      const cantidad = Math.max(parseInt(match[1], 10) || 1, 1);
      const bloqueLimpio = bloque.replace(/\^PQ[^^~]*/i, '^PQ1');
      zplExpandido += bloqueLimpio.repeat(cantidad);
    }

    return zplExpandido;
  }
}
