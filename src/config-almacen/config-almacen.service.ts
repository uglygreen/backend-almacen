import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigAlmacen } from '../entities/config-almacen.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ConfigAlmacenService {
  private readonly logger = new Logger(ConfigAlmacenService.name);

  constructor(
    @InjectRepository(ConfigAlmacen)
    private readonly configRepo: Repository<ConfigAlmacen>,
  ) {}

  // Tarea programada: Ejecutar cada día a las 00:01
  @Cron('0 1 0 * * *') 
  async actualizarFechasAutomaticamente() {
    this.logger.log('Ejecutando actualización automática de fechas de configuración...');
    
    let config = await this.configRepo.findOne({ where: { id: 1 } });
    if (!config) return;

    const hoy = new Date();
    const fechaHoyStr = hoy.toISOString().split('T')[0];

    if (config.modoActualizacion === 'hoy') {
      config.fechaMin = fechaHoyStr;
      config.fechaMax = fechaHoyStr;
      this.logger.log(`Fechas actualizadas a HOY: ${fechaHoyStr}`);
    } 
    else if (config.modoActualizacion === 'dos_dias') {
      const ayer = new Date();
      ayer.setDate(hoy.getDate() - 1);
      const fechaAyerStr = ayer.toISOString().split('T')[0];

      config.fechaMin = fechaAyerStr;
      config.fechaMax = fechaHoyStr;
      this.logger.log(`Fechas actualizadas a DOS DÍAS: ${fechaAyerStr} - ${fechaHoyStr}`);
    } 
    else if (config.modoActualizacion === 'rango') {
      // Si es rango personalizado, movemos ambas fechas un día hacia adelante
      // para mantener la "ventana" de tiempo pero actualizada al día de hoy
      // O según tu requerimiento: "fechaMax siempre sera la fecha actual"
      
      // Opción A: Desplazar todo el rango 1 día
      // Opción B (Según tu descripción): fechaMax = Hoy, fechaMin = Hoy - diferencia original
      
      const antiguaMax = new Date(config.fechaMax);
      const antiguaMin = new Date(config.fechaMin);
      
      // Calculamos la diferencia de días entre Min y Max
      const diferenciaTiempo = antiguaMax.getTime() - antiguaMin.getTime();
      const diasDiferencia = Math.round(diferenciaTiempo / (1000 * 3600 * 24));
      
      // Nueva Max = Hoy
      config.fechaMax = fechaHoyStr;
      
      // Nueva Min = Hoy - diferencia
      const nuevaMin = new Date();
      nuevaMin.setDate(hoy.getDate() - diasDiferencia);
      config.fechaMin = nuevaMin.toISOString().split('T')[0];

      this.logger.log(`Rango actualizado: ${config.fechaMin} - ${config.fechaMax}`);
    }

    await this.configRepo.save(config);
  }

  async obtenerConfiguracion() {
    // Asumimos que solo habrá un registro de configuración (ID = 1)
    let config = await this.configRepo.findOne({ where: { id: 1 } });

    if (!config) {
      // Si no existe, creamos uno por defecto (ej. hoy)
      const hoy = new Date().toISOString().split('T')[0];
      config = this.configRepo.create({
        id: 1,
        fechaMin: hoy,
        fechaMax: hoy,
        modoActualizacion: 'hoy'
      });
      await this.configRepo.save(config);
    }
    return config;
  }

  async actualizarConfiguracion(fechaMin: string, fechaMax: string, modo: string = 'manual') {
    let config = await this.configRepo.findOne({ where: { id: 1 } });
    
    if (!config) {
      config = this.configRepo.create({ id: 1 });
    }

    config.fechaMin = fechaMin;
    config.fechaMax = fechaMax;
    config.modoActualizacion = modo;

    return this.configRepo.save(config);
  }

  async setHoy() {
    const hoy = new Date().toISOString().split('T')[0];
    return this.actualizarConfiguracion(hoy, hoy, 'hoy');
  }

  async setDosDias() {
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    const fechaHoy = hoy.toISOString().split('T')[0];
    const fechaAyer = ayer.toISOString().split('T')[0];

    return this.actualizarConfiguracion(fechaAyer, fechaHoy, 'dos_dias');
  }

  async setRango(fechaMin: string, fechaMax: string) {
    // Cuando el usuario define un rango manualmente, activamos el modo 'rango'
    // para que el cronjob sepa que debe arrastrar este rango en el futuro
    return this.actualizarConfiguracion(fechaMin, fechaMax, 'rango');
  }
}
