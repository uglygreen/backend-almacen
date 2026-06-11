import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlmacenUser } from '../../entities';
import { AuditAlmacenModule } from '../audit-almacen/audit-almacen.module';
import { AuthAlmacenGuard } from './auth-almacen.guard';
import { AuthAlmacenController } from './auth-almacen.controller';
import { AuthAlmacenService } from './auth-almacen.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AlmacenUser]),
    AuditAlmacenModule,
    JwtModule.register({}),
  ],
  controllers: [AuthAlmacenController],
  providers: [AuthAlmacenService, AuthAlmacenGuard],
  exports: [AuthAlmacenGuard, JwtModule, AuthAlmacenService],
})
export class AuthAlmacenModule {}
