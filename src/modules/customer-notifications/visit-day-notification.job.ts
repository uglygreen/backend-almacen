import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { envNumber } from '../../config/runtime-env';
import { Cliente, CustomerNotificationType } from '../../entities';
import { CustomerNotificationsService } from './customer-notifications.service';

@Injectable()
export class VisitDayNotificationJob {
  private readonly logger = new Logger(VisitDayNotificationJob.name);

  constructor(
    @InjectRepository(Cliente, 'legacy_db')
    private readonly clientesRepository: Repository<Cliente>,
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

    const clientes = await this.clientesRepository
      .createQueryBuilder('cliente')
      .select([
        'cliente.clienteId',
        'cliente.numero',
        'cliente.nombre',
        'cliente.activo',
        'cliente.diaVis',
      ])
      .where('cliente.clienteId IN (:...customerIds)', { customerIds })
      .andWhere('TRIM(cliente.diaVis) <> :empty', { empty: '' })
      .getMany();

    const today = this.formatDate(now);
    let processed = 0;

    for (const cliente of clientes) {
      if (!this.isClientActive(cliente.activo)) {
        continue;
      }

      if (!this.matchesVisitDay(cliente.diaVis, now)) {
        continue;
      }

      const result = await this.customerNotificationsService.dispatchCustomerNotification({
        customerId: cliente.clienteId,
        type: CustomerNotificationType.VISIT_DAY,
        title: 'Hoy es tu dia de visita',
        body: 'Puedes crear tus pedidos hoy para recibirlos al dia siguiente.',
        dedupeKey: `${CustomerNotificationType.VISIT_DAY}:${cliente.clienteId}:${today}`,
        scheduledFor: now,
        metadata: {
          evaluatedDate: today,
          numeroCliente: cliente.numero,
          diaVis: (cliente.diaVis ?? '').trim(),
        },
        data: {
          date: today,
          numeroCliente: cliente.numero,
        },
      });

      if (!result.skipped) {
        processed += 1;
      }
    }

    if (processed > 0) {
      this.logger.log(`Job dia de visita ejecutado. Notificaciones procesadas: ${processed}.`);
    }
  }

  private getVisitHour() {
    const hour = envNumber('NOTIFICATION_VISIT_HOUR', 9);
    return Math.min(Math.max(hour, 0), 23);
  }

  private matchesVisitDay(rawVisitDay: string | null | undefined, currentDate: Date) {
    const normalized = this.normalizeDay(rawVisitDay);
    if (!normalized) {
      return false;
    }

    return normalized === this.normalizeDay(this.dayNameFromDate(currentDate));
  }

  private dayNameFromDate(date: Date) {
    const names = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    return names[date.getDay()] ?? '';
  }

  private normalizeDay(value: string | null | undefined) {
    const normalized = (value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (!normalized) {
      return '';
    }

    const aliases: Record<string, string> = {
      lun: 'lunes',
      lunes: 'lunes',
      mon: 'lunes',
      mar: 'martes',
      martes: 'martes',
      tue: 'martes',
      mie: 'miercoles',
      miercoles: 'miercoles',
      mié: 'miercoles',
      wed: 'miercoles',
      jue: 'jueves',
      jueves: 'jueves',
      thu: 'jueves',
      vie: 'viernes',
      viernes: 'viernes',
      fri: 'viernes',
      sab: 'sabado',
      sabado: 'sabado',
      sáb: 'sabado',
      saturday: 'sabado',
      dom: 'domingo',
      domingo: 'domingo',
      sun: 'domingo',
    };

    return aliases[normalized] ?? normalized;
  }

  private isClientActive(value: string | null | undefined) {
    return ['S', 'A', '1', 'Y'].includes((value ?? '').trim().toUpperCase());
  }

  private formatDate(value: Date) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
