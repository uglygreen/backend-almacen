import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigAlmacen } from '../entities/config-almacen.entity';

@Injectable()
export class ConfigAlmacenService {
  constructor(
    @InjectRepository(ConfigAlmacen)
    private readonly configRepo: Repository<ConfigAlmacen>,
  ) {}

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
      });
      await this.configRepo.save(config);
    }
    return config;
  }

  async actualizarConfiguracion(fechaMin: string, fechaMax: string) {
    let config = await this.configRepo.findOne({ where: { id: 1 } });
    
    if (!config) {
      config = this.configRepo.create({ id: 1 });
    }

    config.fechaMin = fechaMin;
    config.fechaMax = fechaMax;

    return this.configRepo.save(config);
  }

  async setHoy() {
    const hoy = new Date().toISOString().split('T')[0];
    return this.actualizarConfiguracion(hoy, hoy);
  }

  async setDosDias() {
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    const fechaHoy = hoy.toISOString().split('T')[0];
    const fechaAyer = ayer.toISOString().split('T')[0];

    return this.actualizarConfiguracion(fechaAyer, fechaHoy);
  }
}
