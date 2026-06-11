import { Injectable } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';

export type ThermalLabelType = 'bulto' | 'producto';

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

  isSupportedLabelType(value: string): value is ThermalLabelType {
    return ThermalLabelsAlmacenService.SUPPORTED_TYPES.includes(value as ThermalLabelType);
  }

  getDownloadFileName(originalFileName: string, labelType: ThermalLabelType) {
    const safeBaseName = originalFileName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9-_]+/g, '_');
    return `${safeBaseName}_${labelType}_termico.pdf`;
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
}
