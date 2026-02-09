import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigAlmacenService } from './config-almacen.service';
import { ConfigAlmacenController } from './config-almacen.controller';
import { ConfigAlmacen } from '../entities/config-almacen.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ConfigAlmacen])],
  controllers: [ConfigAlmacenController],
  providers: [ConfigAlmacenService],
  exports: [ConfigAlmacenService],
})
export class ConfigAlmacenModule {}
