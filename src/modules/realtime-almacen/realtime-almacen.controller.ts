import { Controller, Sse, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AuthAlmacenGuard } from '../auth-almacen/auth-almacen.guard';
import { RealtimeAlmacenService } from './realtime-almacen.service';

@ApiTags('Realtime Almacen')
@Controller('almacen/v1/realtime')
@UseGuards(AuthAlmacenGuard)
export class RealtimeAlmacenController {
  constructor(private readonly realtimeAlmacenService: RealtimeAlmacenService) {}

  @Sse('dashboard-stream')
  @ApiOperation({ summary: 'Stream SSE para refresco del dashboard de almacén' })
  dashboardStream(): Observable<MessageEvent> {
    return this.realtimeAlmacenService.streamDashboardEvents() as Observable<MessageEvent>;
  }
}
