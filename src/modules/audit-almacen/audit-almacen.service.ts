import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditEvent } from './entities/audit-event.entity';
import { GetAuditEventsDto } from './dto/get-audit-events.dto';

type RecordAuditInput = {
  eventType: string;
  entityType?: string;
  entityId?: string | number;
  operatorId?: number;
  status: string;
  sourceModule: string;
  summary: string;
  payload?: Record<string, unknown>;
};

@Injectable()
export class AuditAlmacenService {
  private readonly logger = new Logger(AuditAlmacenService.name);
  private auditTableReady: boolean | null = null;

  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditRepository: Repository<AuditEvent>,
    @InjectDataSource('default')
    private readonly sistemasDataSource: DataSource,
  ) {}

  async recordEvent(input: RecordAuditInput): Promise<number | null> {
    const tableAvailable = await this.ensureAuditTable();
    if (!tableAvailable) {
      this.logger.warn(`Tabla audit_event no disponible. Evento omitido: ${input.eventType}`);
      return null;
    }

    const event = this.auditRepository.create({
      eventType: input.eventType,
      entityType: input.entityType ?? null,
      entityId: input.entityId !== undefined ? String(input.entityId) : null,
      operatorId: input.operatorId ?? null,
      status: input.status,
      sourceModule: input.sourceModule,
      summary: input.summary,
      payload: input.payload ?? null,
    });

    const saved = await this.auditRepository.save(event);
    return saved.id;
  }

  async getEvents(query: GetAuditEventsDto) {
    const tableAvailable = await this.ensureAuditTable();
    if (!tableAvailable) {
      return {
        available: false,
        items: [],
        message: 'La tabla audit_event aún no existe en la base de datos.',
      };
    }

    const qb = this.auditRepository.createQueryBuilder('audit')
      .orderBy('audit.createdAt', 'DESC')
      .take(query.limit ?? 50);

    if (query.eventType) {
      qb.andWhere('audit.eventType = :eventType', { eventType: query.eventType });
    }

    if (query.entityType) {
      qb.andWhere('audit.entityType = :entityType', { entityType: query.entityType });
    }

    if (query.operatorId) {
      qb.andWhere('audit.operatorId = :operatorId', { operatorId: query.operatorId });
    }

    const items = await qb.getMany();

    return {
      available: true,
      items,
    };
  }

  private async ensureAuditTable() {
    if (this.auditTableReady !== null) {
      return this.auditTableReady;
    }

    try {
      const result = await this.sistemasDataSource.query(`SHOW TABLES LIKE 'audit_event'`);
      this.auditTableReady = Array.isArray(result) && result.length > 0;
    } catch (error) {
      this.auditTableReady = false;
      this.logger.warn(`No fue posible verificar audit_event: ${error instanceof Error ? error.message : 'error desconocido'}`);
    }

    return this.auditTableReady;
  }
}
