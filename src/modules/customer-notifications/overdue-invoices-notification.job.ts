import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { envNumber } from '../../config/runtime-env';
import { CustomerNotificationType, DocLegacy } from '../../entities';
import { CustomerNotificationsService } from './customer-notifications.service';

type OverdueInvoiceSummary = {
  customerId: number;
  folios: string[];
  invoiceCount: number;
  maxDaysLate: number;
  totalOverdue: number;
};

@Injectable()
export class OverdueInvoicesNotificationJob {
  private readonly logger = new Logger(OverdueInvoicesNotificationJob.name);

  constructor(
    @InjectRepository(DocLegacy, 'legacy_db')
    private readonly docRepository: Repository<DocLegacy>,
    private readonly customerNotificationsService: CustomerNotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron() {
    const now = new Date();
    if (now.getHours() !== this.getVisitHour()) {
      return;
    }

    const customerIds = await this.customerNotificationsService.getCustomersWithActiveTokens();
    if (!customerIds.length) {
      return;
    }

    const summaries = await this.getOverdueInvoicesByCustomer(customerIds, now);
    const summaryCustomerIds = Array.from(summaries.keys());
    if (!summaryCustomerIds.length) {
      return;
    }

    const intervalDays = this.getIntervalDays();
    const lastSentMap = await this.customerNotificationsService.getLastSentNotificationsByType(
      summaryCustomerIds,
      CustomerNotificationType.OVERDUE_INVOICES,
    );

    const today = this.formatDate(now);
    let processed = 0;

    for (const [customerId, summary] of summaries.entries()) {
      const lastSent = lastSentMap.get(customerId);
      if (!this.shouldSend(lastSent?.sentAt ?? null, now, intervalDays)) {
        continue;
      }

      const result = await this.customerNotificationsService.dispatchCustomerNotification({
        customerId,
        type: CustomerNotificationType.OVERDUE_INVOICES,
        title: 'Tienes facturas atrasadas',
        body: `Tienes ${summary.invoiceCount} factura(s) vencida(s). Revisa tu estado de cuenta en la app.`,
        dedupeKey: `${CustomerNotificationType.OVERDUE_INVOICES}:${customerId}:${today}`,
        scheduledFor: now,
        metadata: {
          evaluatedDate: today,
          folios: summary.folios,
          invoiceCount: summary.invoiceCount,
          maxDaysLate: summary.maxDaysLate,
          totalOverdue: summary.totalOverdue,
          intervalDays,
        },
        data: {
          date: today,
          invoiceCount: summary.invoiceCount,
          maxDaysLate: summary.maxDaysLate,
          folios: summary.folios,
        },
      });

      if (!result.skipped) {
        processed += 1;
      }
    }

    if (processed > 0) {
      this.logger.log(`Job facturas atrasadas ejecutado. Notificaciones procesadas: ${processed}.`);
    }
  }

  private async getOverdueInvoicesByCustomer(customerIds: number[], today: Date) {
    const rows = await this.docRepository
      .createQueryBuilder('doc')
      .select([
        'doc.clienteId',
        'doc.numero',
        'doc.serie',
        'doc.vence',
        'doc.total',
        'doc.totalPagado',
      ])
      .where('doc.clienteId IN (:...customerIds)', { customerIds })
      .andWhere('doc.tipo = :tipo', { tipo: 'F' })
      .andWhere('doc.estado = :estado', { estado: 'I' })
      .andWhere('(COALESCE(doc.total, 0) - COALESCE(doc.totalPagado, 0)) > 0')
      .andWhere('doc.vence < :today', { today: this.formatDate(today) })
      .orderBy('doc.vence', 'ASC')
      .getMany();

    const grouped = new Map<number, OverdueInvoiceSummary>();

    for (const row of rows) {
      const customerId = Number(row.clienteId);
      if (!Number.isFinite(customerId) || customerId <= 0) {
        continue;
      }

      const current = grouped.get(customerId) ?? {
        customerId,
        folios: [],
        invoiceCount: 0,
        maxDaysLate: 0,
        totalOverdue: 0,
      };

      const dueDate = this.toDateOnly(row.vence);
      const daysLate = dueDate ? Math.max(this.diffInDays(today, dueDate), 0) : 0;
      const pendingAmount = this.toMoney(this.toNumber(row.total) - this.toNumber(row.totalPagado));

      current.invoiceCount += 1;
      current.maxDaysLate = Math.max(current.maxDaysLate, daysLate);
      current.totalOverdue = this.toMoney(current.totalOverdue + pendingAmount);
      current.folios.push(this.buildFolio(row.serie, row.numero));
      grouped.set(customerId, current);
    }

    return grouped;
  }

  private getVisitHour() {
    const hour = envNumber('NOTIFICATION_VISIT_HOUR', 9);
    return Math.min(Math.max(hour, 0), 23);
  }

  private getIntervalDays() {
    const value = envNumber('OVERDUE_NOTIFICATION_INTERVAL_DAYS', 1);
    return Math.max(value, 1);
  }

  private shouldSend(lastSentAt: Date | null, currentDate: Date, intervalDays: number) {
    if (!lastSentAt) {
      return true;
    }

    const lastSentDate = this.toDateOnly(lastSentAt);
    const today = this.toDateOnly(currentDate);
    if (!lastSentDate || !today) {
      return true;
    }

    return this.diffInDays(today, lastSentDate) >= intervalDays;
  }

  private buildFolio(serie: string | null | undefined, numero: number | string | null | undefined) {
    const cleanSerie = (serie ?? '').trim();
    const cleanNumero = `${numero ?? ''}`.trim();

    if (cleanSerie && cleanNumero) {
      return `${cleanSerie}-${cleanNumero}`;
    }

    return cleanSerie || cleanNumero || 'SIN-FOLIO';
  }

  private toDateOnly(value: Date | string | null | undefined) {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private diffInDays(dateA: Date, dateB: Date) {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((dateA.getTime() - dateB.getTime()) / msPerDay);
  }

  private toNumber(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private toMoney(value: number) {
    return Number(value.toFixed(2));
  }

  private formatDate(value: Date) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
