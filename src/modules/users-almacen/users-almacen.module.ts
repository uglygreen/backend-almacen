import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlmacenUser } from '../../entities';
import { AuthAlmacenModule } from '../auth-almacen/auth-almacen.module';
import { UsersAlmacenController } from './users-almacen.controller';
import { UsersAlmacenService } from './users-almacen.service';

@Module({
  imports: [TypeOrmModule.forFeature([AlmacenUser]), AuthAlmacenModule],
  controllers: [UsersAlmacenController],
  providers: [UsersAlmacenService],
  exports: [UsersAlmacenService],
})
export class UsersAlmacenModule {}
