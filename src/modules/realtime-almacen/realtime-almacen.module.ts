import { Module } from '@nestjs/common';
import { AuthAlmacenModule } from '../auth-almacen/auth-almacen.module';
import { RealtimeAlmacenController } from './realtime-almacen.controller';
import { RealtimeAlmacenService } from './realtime-almacen.service';

@Module({
  imports: [AuthAlmacenModule],
  controllers: [RealtimeAlmacenController],
  providers: [RealtimeAlmacenService],
  exports: [RealtimeAlmacenService],
})
export class RealtimeAlmacenModule {}
