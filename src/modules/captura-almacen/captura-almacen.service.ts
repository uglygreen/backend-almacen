import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Surtido } from '../../entities';
import { AuditAlmacenService } from '../audit-almacen/audit-almacen.service';
import { OrdersAlmacenService } from '../orders-almacen/orders-almacen.service';
import { RealtimeAlmacenService } from '../realtime-almacen/realtime-almacen.service';
import { CreateSurtidoAlmacenDto } from './dto/create-surtido-almacen.dto';

@Injectable()
export class CapturaAlmacenService {
  constructor(
    @InjectRepository(Surtido)
    private readonly surtidoRepository: Repository<Surtido>,
    private readonly ordersAlmacenService: OrdersAlmacenService,
    private readonly realtimeAlmacenService: RealtimeAlmacenService,
    private readonly auditAlmacenService: AuditAlmacenService,
  ) {}

  async createSurtido(dto: CreateSurtidoAlmacenDto) {
    const validation = await this.ordersAlmacenService.validateOrder({
      operatorId: dto.operatorId,
      serie: dto.serie,
      folio: dto.folio,
      location: dto.location,
    });

    if (!validation.valid && validation.code === 'ORDER_ALREADY_CAPTURED') {
      throw new ConflictException('El pedido ya fue registrado previamente');
    }

    if (!validation.valid) {
      throw new UnprocessableEntityException(validation);
    }

    const partidas = validation.capture?.partidas ?? 0;
    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const hora = now.toTimeString().slice(0, 8);
    const location = dto.location.toUpperCase();

    const surtido = this.surtidoRepository.create({
      idAlmacenista: dto.operatorId,
      fecha,
      hora,
      partidas,
      pedido: dto.folio,
      lugar: location,
      serie: dto.serie,
    });

    const saved = await this.surtidoRepository.save(surtido);
    const auditId = await this.auditAlmacenService.recordEvent({
      eventType: 'surtido.created',
      entityType: 'Surtido',
      entityId: saved.idSurtido,
      operatorId: dto.operatorId,
      status: 'success',
      sourceModule: 'captura-almacen',
      summary: `Surtido ${saved.idSurtido} registrado para pedido ${dto.serie}-${dto.folio}`,
      payload: {
        surtidoId: saved.idSurtido,
        operatorId: dto.operatorId,
        pedido: dto.folio,
        serie: dto.serie,
        partidas,
        location,
      },
    });

    this.realtimeAlmacenService.publishSurtidoCreated({
      surtidoId: saved.idSurtido,
      operatorId: dto.operatorId,
      pedido: dto.folio,
      partidas,
      location,
    });

    return {
      status: 'registered',
      surtidoId: saved.idSurtido,
      registeredAt: now.toISOString(),
      partidas: saved.partidas,
      operator: {
        id: dto.operatorId,
        name: validation.operator.name,
      },
      auditId,
      idempotencyKey: dto.idempotencyKey ?? `captura-${dto.operatorId}-${dto.serie}-${dto.folio}-${location}`,
    };
  }
}
