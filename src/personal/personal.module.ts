import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalService } from './personal.service';
import { PersonalController } from './personal.controller';
import { Personal } from 'src/entities/personal.entity';

@Module({
  // Registramos la entidad para que TypeORM cree el repositorio
  imports: [TypeOrmModule.forFeature([Personal], 'legacy_db')],
  controllers: [PersonalController],
  providers: [PersonalService],
  exports: [PersonalService], // Opcional: expórtalo si lo vas a usar en otros módulos
})
export class PersonalModule {}