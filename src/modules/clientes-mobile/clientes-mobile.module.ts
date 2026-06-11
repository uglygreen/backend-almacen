import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente, ClienteMobileOtp, ClienteMobileSession, CorreoLegacy, DocLegacy } from '../../entities';
import { ClientesMobileAuthGuard } from './clientes-mobile-auth.guard';
import { ClientesMobileController } from './clientes-mobile.controller';
import { ClientesMobileMailService } from './clientes-mobile-mail.service';
import { ClientesMobileRateLimitService } from './clientes-mobile-rate-limit.service';
import { ClientesMobileService } from './clientes-mobile.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cliente, CorreoLegacy, DocLegacy], 'legacy_db'),
    TypeOrmModule.forFeature([ClienteMobileOtp, ClienteMobileSession]),
    JwtModule.register({}),
  ],
  controllers: [ClientesMobileController],
  providers: [ClientesMobileService, ClientesMobileAuthGuard, ClientesMobileMailService, ClientesMobileRateLimitService],
  exports: [ClientesMobileService, ClientesMobileAuthGuard, ClientesMobileMailService, ClientesMobileRateLimitService, JwtModule],
})
export class ClientesMobileModule {}
