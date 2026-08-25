import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ClienteMobileSession,
  CustomerNotificationType,
  PagoLegacy,
  PaymentNotificationCheckpoint,
} from '../../entities';
import { MoreThan, Repository } from 'typeorm';
import { CustomerNotificationsService } from './customer-notifications.service';

type PaymentInvoiceImpact = {
  docId: number;
  folio: string;
  total: number;
  previouslyPaid: number;
  currentApplied: number;
  resultingPaid: number;
  fullyPaid: boolean;
};

@Injectable()
export class PaymentNotificationJob {
  private readonly logger = new Logger(PaymentNotificationJob.name);
  private readonly jobKey = 'customer-payment-notifications';
  private readonly batchSize = 50;
  private isRunning = false;

  constructor(
    @InjectRepository(PaymentNotificationCheckpoint)
    private readonly checkpointRepository: Repository<PaymentNotificationCheckpoint>,
    @InjectRepository(ClienteMobileSession)
    private readonly sessionsRepository: Repository<ClienteMobileSession>,
    @InjectRepository(PagoLegacy, 'legacy_db')
    private readonly pagoRepository: Repository<PagoLegacy>,
    private readonly customerNotificationsService: CustomerNotificationsService,
  ) {}

  @Cron('*/5 * * * * *')
  async handleCron() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const checkpoint = await this.getOrCreateCheckpoint();
      const pagos = await this.pagoRepository.find({
        where: {
          pgId: MoreThan(checkpoint.lastPgId),
        },
        relations: {
          complementoPago: {
            cfd: true,
          },
          aplicacionesDocumento: {
            doc: true,
          },
        },
        order: {
          pgId: 'ASC',
        },
        take: this.batchSize,
      });

      if (!pagos.length) {
        return;
      }

      for (const pago of pagos) {
        await this.processPayment(pago);
        checkpoint.lastPgId = pago.pgId;
        checkpoint.lastPaymentAt = pago.pgFecha ?? pago.pgFechaAplicada ?? null;
        checkpoint.lastProcessedAt = new Date();
        await this.checkpointRepository.save(checkpoint);
      }

      this.logger.log(`Job de pagos ejecutado. Pagos procesados: ${pagos.length}. Último PGID: ${checkpoint.lastPgId}.`);
    } catch (error: any) {
      this.logger.error(`Error procesando notificaciones de pagos: ${error?.message ?? error}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async processPayment(pago: PagoLegacy) {
    const customerId = Number(pago.pgClienteId);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      return;
    }

    const hasRegisteredSession = await this.hasRegisteredMobileSession(customerId);
    if (!hasRegisteredSession) {
      this.logger.debug(
        `Pago ${pago.pgId} omitido para notificaciones: el cliente ${customerId} no existe en clientes_mobile_sessions.`,
      );
      return;
    }

    const paymentDate = pago.pgFecha ?? pago.pgFechaAplicada ?? new Date();
    const impacts = await this.resolveInvoiceImpacts(pago);
    const fullyPaidInvoices = impacts.filter((impact) => impact.fullyPaid);

    await this.customerNotificationsService.dispatchCustomerNotification({
      customerId,
      type: CustomerNotificationType.PAYMENT_RECEIVED,
      title: 'Pago recibido',
      body: `Registramos tu pago por ${this.formatMoney(pago.pgImporte)} el día ${this.formatDisplayDate(paymentDate)}.`,
      dedupeKey: `${CustomerNotificationType.PAYMENT_RECEIVED}:${pago.pgId}`,
      scheduledFor: new Date(),
      metadata: {
        source: 'payment_notification_job',
        paymentId: pago.pgId,
        paymentDate: this.formatIsoDateTime(paymentDate),
        paymentAppliedDate: this.formatIsoDate(pago.pgFechaAplicada),
        amount: this.toMoney(pago.pgImporte),
        reference: this.cleanNullableString(pago.pgReferencia),
        receipt: this.toNullableNumber(pago.pgRecibo),
        form: this.cleanNullableString(pago.pgFormaPago),
        complementoPagoId: pago.pgCompagId ?? null,
        invoicesCount: impacts.length,
      },
      data: {
        type: CustomerNotificationType.PAYMENT_RECEIVED,
        paymentId: pago.pgId,
        amount: this.toMoney(pago.pgImporte),
        paymentDate: this.formatIsoDateTime(paymentDate),
      },
    });

    // for (const impact of fullyPaidInvoices) {
    //   await this.customerNotificationsService.dispatchCustomerNotification({
    //     customerId,
    //     type: CustomerNotificationType.INVOICE_PAID,
    //     title: 'Factura liquidada',
    //     body: `Tu factura ${impact.folio} quedó pagada en su totalidad.`,
    //     dedupeKey: `${CustomerNotificationType.INVOICE_PAID}:${pago.pgId}:${impact.docId}`,
    //     scheduledFor: new Date(),
    //     metadata: {
    //       source: 'payment_notification_job',
    //       paymentId: pago.pgId,
    //       documentId: impact.docId,
    //       folio: impact.folio,
    //       total: impact.total,
    //       previouslyPaid: impact.previouslyPaid,
    //       currentApplied: impact.currentApplied,
    //       resultingPaid: impact.resultingPaid,
    //     },
    //     data: {
    //       type: CustomerNotificationType.INVOICE_PAID,
    //       paymentId: pago.pgId,
    //       documentId: impact.docId,
    //       folio: impact.folio,
    //     },
    //   });
    // }

    if (impacts.length > 1) {
      await this.customerNotificationsService.dispatchCustomerNotification({
        customerId,
        type: CustomerNotificationType.PAYMENT_COMPLEMENT_APPLIED,
        title: 'Pago aplicado a varias facturas',
        body: `Se aplicó un pago a ${impacts.length} factura(s). ${fullyPaidInvoices.length} quedaron liquidadas.`,
        dedupeKey: `${CustomerNotificationType.PAYMENT_COMPLEMENT_APPLIED}:${pago.pgId}`,
        scheduledFor: new Date(),
        metadata: {
          source: 'payment_notification_job',
          paymentId: pago.pgId,
          complementoPagoId: pago.pgCompagId ?? null,
          invoicesCount: impacts.length,
          fullyPaidCount: fullyPaidInvoices.length,
          invoices: impacts.map((impact) => ({
            docId: impact.docId,
            folio: impact.folio,
            fullyPaid: impact.fullyPaid,
            currentApplied: impact.currentApplied,
          })),
        },
        data: {
          type: CustomerNotificationType.PAYMENT_COMPLEMENT_APPLIED,
          paymentId: pago.pgId,
          invoicesCount: impacts.length,
          fullyPaidCount: fullyPaidInvoices.length,
        },
      });
    }
  }

  private async resolveInvoiceImpacts(pago: PagoLegacy) {
    const grouped = new Map<number, { folio: string; total: number; currentApplied: number }>();

    for (const application of pago.aplicacionesDocumento ?? []) {
      const doc = application.doc;
      if (!doc?.docId || (doc.tipo ?? '').trim().toUpperCase() !== 'F') {
        continue;
      }

      const current = grouped.get(doc.docId) ?? {
        folio: this.buildFolio(doc.serie, doc.numero),
        total: this.toMoney(doc.total),
        currentApplied: 0,
      };

      current.currentApplied = this.toMoney(current.currentApplied + this.toMoney(application.pagado));
      grouped.set(doc.docId, current);
    }

    const impacts: PaymentInvoiceImpact[] = [];
    for (const [docId, groupedInvoice] of grouped.entries()) {
      const previousPaidRaw = await this.getPreviouslyPaidAmount(docId, pago.pgId);
      const previouslyPaid = this.toMoney(previousPaidRaw);
      const resultingPaid = this.toMoney(previouslyPaid + groupedInvoice.currentApplied);
      const fullyPaid = resultingPaid + 0.009 >= groupedInvoice.total;

      impacts.push({
        docId,
        folio: groupedInvoice.folio,
        total: groupedInvoice.total,
        previouslyPaid,
        currentApplied: groupedInvoice.currentApplied,
        resultingPaid,
        fullyPaid,
      });
    }

    return impacts;
  }

  private async getPreviouslyPaidAmount(docId: number, currentPgId: number) {
    const row = await this.pagoRepository
      .createQueryBuilder('pago')
      .innerJoin('pago.aplicacionesDocumento', 'pagDoc')
      .select('COALESCE(SUM(pagDoc.pagado), 0)', 'total')
      .where('pagDoc.docId = :docId', { docId })
      .andWhere('pago.pgId < :currentPgId', { currentPgId })
      .getRawOne<{ total: string | number | null }>();

    return this.toMoney(row?.total);
  }

  private async getOrCreateCheckpoint() {
    const existing = await this.checkpointRepository.findOne({
      where: { jobKey: this.jobKey },
    });

    if (existing) {
      return existing;
    }

    return this.checkpointRepository.save(
      this.checkpointRepository.create({
        jobKey: this.jobKey,
        lastPgId: 871750,
        lastPaymentAt: null,
        lastProcessedAt: null,
      }),
    );
  }

  private async hasRegisteredMobileSession(customerId: number) {
    const total = await this.sessionsRepository.count({
      where: {
        clienteId: customerId,
      },
      take: 1,
    });

    return total > 0;
  }

  private buildFolio(serie: string | null | undefined, numero: number | string | null | undefined) {
    const cleanSerie = (serie ?? '').trim();
    const cleanNumero = `${numero ?? ''}`.trim();

    if (cleanSerie && cleanNumero) {
      return `${cleanSerie}-${cleanNumero}`;
    }

    return cleanSerie || cleanNumero || 'SIN-FOLIO';
  }

  private formatMoney(value: number | string | null | undefined) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.toMoney(value));
  }

  private formatDisplayDate(value: Date | string | null | undefined) {
    const date = this.toDate(value);
    if (!date) {
      return 'sin fecha';
    }

    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private formatIsoDate(value: Date | string | null | undefined) {
    const date = this.toDate(value);
    if (!date) {
      return null;
    }

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatIsoDateTime(value: Date | string | null | undefined) {
    const date = this.toDate(value);
    if (!date) {
      return null;
    }

    const datePart = this.formatIsoDate(date);
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    const seconds = `${date.getSeconds()}`.padStart(2, '0');
    return `${datePart} ${hours}:${minutes}:${seconds}`;
  }

  private toDate(value: Date | string | null | undefined) {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toNullableNumber(value: number | string | null | undefined) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private toMoney(value: number | string | null | undefined) {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return Number(numeric.toFixed(2));
  }

  private cleanNullableString(value: string | null | undefined) {
    const normalized = (value ?? '').trim();
    return normalized || null;
  }
}
