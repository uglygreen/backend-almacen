import { Module } from '@nestjs/common';
import { MetricasService } from './metricas.service';
import { MetricasController } from './metricas.controller';

@Module({
    controllers: [MetricasController],
    providers: [MetricasService],
})
export class MetricasModule {}
