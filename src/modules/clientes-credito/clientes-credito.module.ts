import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente, ClienteCreditoExcepcion, DocLegacy } from '../../entities';
import { AuthAlmacenModule } from '../auth-almacen/auth-almacen.module';
import { ClientesCreditoController } from './clientes-credito.controller';
import { ClientesCreditoService } from './clientes-credito.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cliente, DocLegacy], 'legacy_db'),
    TypeOrmModule.forFeature([ClienteCreditoExcepcion]),
    AuthAlmacenModule,
  ],
  controllers: [ClientesCreditoController],
  providers: [ClientesCreditoService],
  exports: [ClientesCreditoService],
})
export class ClientesCreditoModule {}
