import { Module } from '@nestjs/common';
import { AuthAlmacenModule } from '../auth-almacen/auth-almacen.module';
import { HistoricalAlmacenController } from './historical-almacen.controller';
import { HistoricalAlmacenService } from './historical-almacen.service';

@Module({
  imports: [AuthAlmacenModule],
  controllers: [HistoricalAlmacenController],
  providers: [HistoricalAlmacenService],
})
export class HistoricalAlmacenModule {}
