import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { Cliente } from '../entities/cliente.entity';

@Module({
  imports: [
    // Registramos la entidad Cliente en la conexión 'legacy_db'
    TypeOrmModule.forFeature([Cliente], 'legacy_db'),
  ],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
