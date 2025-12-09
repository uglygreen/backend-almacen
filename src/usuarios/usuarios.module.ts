import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlmacenUser } from 'src/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AlmacenUser
    ])
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
