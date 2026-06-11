import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from './entities/audit-event.entity';
import { AuditAlmacenController } from './audit-almacen.controller';
import { AuditAlmacenService } from './audit-almacen.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  controllers: [AuditAlmacenController],
  providers: [AuditAlmacenService],
  exports: [AuditAlmacenService],
})
export class AuditAlmacenModule {}
