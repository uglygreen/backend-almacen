import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaService } from './asistencia.service';
import { IclockTransaction } from './entities/iclock-transaction.entity';
import { PersonnelEmployee } from './entities/personnel-employee.entity';
import { PersonnelPosition } from './entities/personnel-position.entity';
import { PersonnelDepartment } from './entities/personnel-department.entity';
import { PersonnelResign } from './entities/personnel-resign.entity';
import { TestDbController } from './test-db.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [IclockTransaction, PersonnelEmployee, PersonnelPosition, PersonnelDepartment, PersonnelResign],
      'zkteco_db'
    ),
    TypeOrmModule.forFeature(
      [IclockTransaction, PersonnelEmployee, PersonnelPosition, PersonnelDepartment, PersonnelResign],
      'zkteco_tequis_db'
    ),
  ],
  controllers: [AsistenciaController, TestDbController],
  providers: [AsistenciaService],
  exports: [AsistenciaService],
})
export class AsistenciaModule {}
