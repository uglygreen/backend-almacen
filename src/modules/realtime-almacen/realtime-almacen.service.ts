import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';

type RealtimeAlmacenPayload = {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
};

@Injectable()
export class RealtimeAlmacenService {
  private readonly dashboardEvents$ = new Subject<RealtimeAlmacenPayload>();

  publishSurtidoCreated(payload: {
    surtidoId: number;
    operatorId: number;
    pedido: number;
    partidas: number;
    location: string;
  }) {
    this.dashboardEvents$.next({
      type: 'surtido-created',
      timestamp: new Date().toISOString(),
      data: payload,
    });
  }

  streamDashboardEvents(): Observable<MessageEvent> {
    return this.dashboardEvents$.pipe(
      map((event) => ({
        type: event.type,
        data: event,
      })),
    );
  }
}
