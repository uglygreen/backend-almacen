import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAlmacenService } from './audit-almacen.service';
import { GetAuditEventsDto } from './dto/get-audit-events.dto';

@ApiTags('Audit Almacen')
@Controller('almacen/v1/audit')
export class AuditAlmacenController {
  constructor(private readonly auditAlmacenService: AuditAlmacenService) {}

  @Get('events')
  @ApiOperation({ summary: 'Consulta eventos auditables de la migración de almacén' })
  getEvents(@Query() query: GetAuditEventsDto) {
    return this.auditAlmacenService.getEvents(query);
  }
}
