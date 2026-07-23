import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlmacenUser, AlmacenUserBaseConfig } from '../../entities';
import { UpdatePersonalBaseConfigDto } from './dto/update-personal-base-config.dto';

type PersonalBaseDefinition = {
  area: string;
  seccion: string;
  nombre: string;
  basePersonal: number;
};

const PERSONAL_BASE_DEFINITIONS: PersonalBaseDefinition[] = [
  { area: 'almacen', seccion: 'zona01', nombre: 'Almacen Zona 1', basePersonal: 11 },
  { area: 'almacen', seccion: 'zona02', nombre: 'Almacen Zona 2', basePersonal: 11 },
  { area: 'asesor', seccion: 'zona01', nombre: 'Asesores Zona 1', basePersonal: 7 },
  { area: 'asesor', seccion: 'zona02', nombre: 'Asesores Zona 2', basePersonal: 7 },
  { area: 'chofer', seccion: 'chofer01', nombre: 'Choferes Zona 1', basePersonal: 10 },
  { area: 'chofer', seccion: 'chofer02', nombre: 'Choferes Zona 2', basePersonal: 5 },
  { area: 'apoyo', seccion: 'apoyo', nombre: 'Apoyo', basePersonal: 4 },
  { area: 'auxiliar', seccion: 'auxiliar', nombre: 'Auxiliar', basePersonal: 4 },
];

@Injectable()
export class PersonalBaseAlmacenService {
  constructor(
    @InjectRepository(AlmacenUserBaseConfig)
    private readonly configRepository: Repository<AlmacenUserBaseConfig>,
    @InjectRepository(AlmacenUser)
    private readonly almacenUserRepository: Repository<AlmacenUser>,
  ) {}

  async listConfiguraciones() {
    await this.ensureDefaultConfigs();
    const configs = await this.configRepository.find({
      order: {
        area: 'ASC',
        seccion: 'ASC',
      },
    });

    const counts = await this.buildUserCounts();

    return configs
      .map((config) => {
        const definition = this.findDefinition(config.area, config.seccion);
        const key = this.buildKey(config.area, config.seccion);
        const count = counts.get(key) ?? { usuariosRegistrados: 0, usuariosActivos: 0 };

        return {
          id: config.id,
          nombre: definition.nombre,
          area: config.area,
          seccion: config.seccion,
          basePersonal: config.basePersonal,
          usuariosRegistrados: count.usuariosRegistrados,
          usuariosActivos: count.usuariosActivos,
          diferenciaVsBase: config.basePersonal - count.usuariosActivos,
          createdAt: this.toIsoString(config.createdAt),
          updatedAt: this.toIsoString(config.updatedAt),
        };
      })
      .sort((a, b) => this.getDefinitionIndex(a.area, a.seccion) - this.getDefinitionIndex(b.area, b.seccion));
  }

  async updateConfiguracion(dto: UpdatePersonalBaseConfigDto) {
    await this.ensureDefaultConfigs();
    const area = this.normalizeValue(dto.area);
    const seccion = this.normalizeValue(dto.seccion);
    const definition = this.findDefinition(area, seccion);

    let config = await this.configRepository.findOne({
      where: { area, seccion },
    });

    if (!config) {
      config = this.configRepository.create({
        area,
        seccion,
        basePersonal: definition.basePersonal,
      });
    }

    config.basePersonal = dto.basePersonal;
    await this.configRepository.save(config);

    const [updated] = await this.getConfiguracionesByKeys([this.buildKey(area, seccion)]);
    return updated;
  }

  async updateManyConfiguraciones(configuraciones: UpdatePersonalBaseConfigDto[]) {
    await this.ensureDefaultConfigs();

    const seen = new Set<string>();
    const entitiesToSave: AlmacenUserBaseConfig[] = [];

    for (const item of configuraciones) {
      const area = this.normalizeValue(item.area);
      const seccion = this.normalizeValue(item.seccion);
      this.findDefinition(area, seccion);

      const key = this.buildKey(area, seccion);
      if (seen.has(key)) {
        throw new BadRequestException(`La combinación ${area}/${seccion} está repetida en la solicitud`);
      }
      seen.add(key);

      let config = await this.configRepository.findOne({
        where: { area, seccion },
      });

      if (!config) {
        config = this.configRepository.create({ area, seccion });
      }

      config.basePersonal = item.basePersonal;
      entitiesToSave.push(config);
    }

    if (entitiesToSave.length > 0) {
      await this.configRepository.save(entitiesToSave);
    }

    return this.getConfiguracionesByKeys([...seen]);
  }

  private async getConfiguracionesByKeys(keys: string[]) {
    const all = await this.listConfiguraciones();
    const keySet = new Set(keys);
    return all.filter((item) => keySet.has(this.buildKey(item.area, item.seccion)));
  }

  private async ensureDefaultConfigs() {
    const existing = await this.configRepository.find();
    const existingKeys = new Set(existing.map((item) => this.buildKey(item.area, item.seccion)));

    const missing = PERSONAL_BASE_DEFINITIONS
      .filter((item) => !existingKeys.has(this.buildKey(item.area, item.seccion)))
      .map((item) =>
        this.configRepository.create({
          area: item.area,
          seccion: item.seccion,
          basePersonal: item.basePersonal,
        }),
      );

    if (missing.length > 0) {
      await this.configRepository.save(missing);
    }
  }

  private async buildUserCounts() {
    const counts = new Map<string, { usuariosRegistrados: number; usuariosActivos: number }>();

    for (const definition of PERSONAL_BASE_DEFINITIONS) {
      const where = {
        area: definition.area,
        seccion: definition.seccion,
      };

      const [usuariosRegistrados, usuariosActivos] = await Promise.all([
        this.almacenUserRepository.count({ where }),
        this.almacenUserRepository.count({
          where: {
            ...where,
            activo: true,
          },
        }),
      ]);

      counts.set(this.buildKey(definition.area, definition.seccion), {
        usuariosRegistrados,
        usuariosActivos,
      });
    }

    return counts;
  }

  private findDefinition(area: string, seccion: string) {
    const definition = PERSONAL_BASE_DEFINITIONS.find(
      (item) => item.area === area && item.seccion === seccion,
    );

    if (!definition) {
      throw new BadRequestException(
        `La combinación ${area}/${seccion} no es válida para la configuración de personal de almacén`,
      );
    }

    return definition;
  }

  private getDefinitionIndex(area: string, seccion: string) {
    return PERSONAL_BASE_DEFINITIONS.findIndex(
      (item) => item.area === area && item.seccion === seccion,
    );
  }

  private buildKey(area: string, seccion: string) {
    return `${area}::${seccion}`;
  }

  private normalizeValue(value: string) {
    return (value ?? '').trim().toLowerCase();
  }

  private toIsoString(value: Date | null | undefined) {
    return value ? new Date(value).toISOString() : null;
  }
}
