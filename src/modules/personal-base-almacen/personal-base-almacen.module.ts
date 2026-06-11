import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlmacenUser, AlmacenUserBaseConfig } from '../../entities';
import { AuthAlmacenModule } from '../auth-almacen/auth-almacen.module';
import { PersonalBaseAlmacenController } from './personal-base-almacen.controller';
import { PersonalBaseAlmacenService } from './personal-base-almacen.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AlmacenUserBaseConfig, AlmacenUser]),
    AuthAlmacenModule,
  ],
  controllers: [PersonalBaseAlmacenController],
  providers: [PersonalBaseAlmacenService],
  exports: [PersonalBaseAlmacenService],
})
export class PersonalBaseAlmacenModule {}
