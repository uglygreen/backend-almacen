import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GarantiasService } from './garantias.service';
import { GarantiasController } from './garantias.controller';
import { WhatsappService } from './whatsapp.service';
import { EventsModule } from '../events/events.module';
import { Garantia, HistorialEstatusGarantia, MediaGarantia } from '../entities/garantia.entity';
import { Cliente } from '../entities/cliente.entity';
import { Producto } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Garantia, HistorialEstatusGarantia, MediaGarantia, Producto]), // Default DB
    TypeOrmModule.forFeature([Cliente], 'legacy_db'), // Legacy DB
    EventsModule
  ],
  controllers: [GarantiasController],
  providers: [GarantiasService, WhatsappService],
})
export class GarantiasModule {}
