import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CfdLegacy, Cliente, CompagLegacy, DocLegacy, PagDocLegacy, PagoLegacy } from '../../entities';
import { CuentasPorCobrarBackofficeController } from './cuentas-por-cobrar-backoffice.controller';
import { CuentasPorCobrarBackofficeService } from './cuentas-por-cobrar-backoffice.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cliente, CompagLegacy, CfdLegacy, PagoLegacy, PagDocLegacy, DocLegacy], 'legacy_db'),
  ],
  controllers: [CuentasPorCobrarBackofficeController],
  providers: [CuentasPorCobrarBackofficeService],
  exports: [CuentasPorCobrarBackofficeService],
})
export class CuentasPorCobrarBackofficeModule {}
