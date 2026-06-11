import { Module } from '@nestjs/common';
import { ThermalLabelsAlmacenController } from './thermal-labels-almacen.controller';
import { ThermalLabelsAlmacenService } from './thermal-labels-almacen.service';

@Module({
  controllers: [ThermalLabelsAlmacenController],
  providers: [ThermalLabelsAlmacenService],
})
export class ThermalLabelsAlmacenModule {}
