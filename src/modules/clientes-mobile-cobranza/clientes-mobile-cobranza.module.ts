import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CfdLegacy, ClienteMobileSession, CompagLegacy, DocLegacy, PagDocLegacy } from '../../entities';
import { ClientesMobileAuthGuard } from '../clientes-mobile/clientes-mobile-auth.guard';
import { ClientesMobileCobranzaController } from './clientes-mobile-cobranza.controller';
import { ClientesMobileCobranzaService } from './clientes-mobile-cobranza.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocLegacy, CfdLegacy, PagDocLegacy, CompagLegacy], 'legacy_db'),
    TypeOrmModule.forFeature([ClienteMobileSession]),
    JwtModule.register({}),
  ],
  controllers: [ClientesMobileCobranzaController],
  providers: [ClientesMobileCobranzaService, ClientesMobileAuthGuard],
  exports: [ClientesMobileCobranzaService],
})
export class ClientesMobileCobranzaModule {}
