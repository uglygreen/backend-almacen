import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { envString } from '../../config/runtime-env';
import { CreateCatalogoPromoMesDto } from './dto/create-catalogo-promo-mes.dto';
import { CreateProductoPromoMesDto } from './dto/create-producto-promo-mes.dto';
import { ListProductosPromoMesDto } from './dto/list-productos-promo-mes.dto';
import { UpdateCatalogoPromoMesDto } from './dto/update-catalogo-promo-mes.dto';
import { UpdateProductoPromoMesDto } from './dto/update-producto-promo-mes.dto';
import { CatalogoPromoMes } from './entities/catalogo-promo-mes.entity';
import { ProductoPromoMes } from './entities/producto-promo-mes.entity';

type LegacyProductoMes = {
  articuloId: number;
  clave: string | null;
  codigoProveedor: string | null;
  descripcion: string | null;
  marca: string | null;
  imagen: string | null;
};

@Injectable()
export class ProductosPromoMesService {
  private readonly catalogImageBaseUrl = envString(
    'CLIENTES_MOBILE_CATALOG_IMAGE_BASE_URL',
    'https://ferremayoristas.com.mx/assets/photos-img/',
  );

  constructor(
    @InjectRepository(CatalogoPromoMes)
    private readonly catalogosRepository: Repository<CatalogoPromoMes>,
    @InjectRepository(ProductoPromoMes)
    private readonly productosRepository: Repository<ProductoPromoMes>,
    @InjectDataSource('legacy_db')
    private readonly legacyDataSource: DataSource,
  ) {}

  async listCatalogos() {
    const catalogos = await this.catalogosRepository.find({
      order: { fechaRegistro: 'DESC', id: 'DESC' },
    });

    return Promise.all(
      catalogos.map(async (catalogo) => ({
        ...this.mapCatalogo(catalogo),
        totalProductos: await this.productosRepository.countBy({
          catalogoId: catalogo.id,
        }),
      })),
    );
  }

  async getCatalogo(catalogoId: number) {
    const catalogo = await this.findCatalogoOrFail(catalogoId);
    return {
      ...this.mapCatalogo(catalogo),
      totalProductos: await this.productosRepository.countBy({
        catalogoId: catalogo.id,
      }),
    };
  }

  async createCatalogo(dto: CreateCatalogoPromoMesDto) {
    const nombrePeriodo = this.normalizePeriodo(dto.nombrePeriodo);
    const existente = await this.catalogosRepository.findOne({
      where: { nombrePeriodo },
    });

    if (existente) {
      throw new BadRequestException(
        `Ya existe un catálogo registrado con el periodo ${nombrePeriodo}`,
      );
    }

    const catalogo = this.catalogosRepository.create({
      nombrePeriodo,
      fechaRegistro: dto.fechaRegistro
        ? new Date(dto.fechaRegistro)
        : new Date(),
    });

    const saved = await this.catalogosRepository.save(catalogo);
    return this.mapCatalogo(saved);
  }

  async updateCatalogo(catalogoId: number, dto: UpdateCatalogoPromoMesDto) {
    const catalogo = await this.findCatalogoOrFail(catalogoId);

    if (dto.nombrePeriodo !== undefined) {
      const nombrePeriodo = this.normalizePeriodo(dto.nombrePeriodo);
      const duplicado = await this.catalogosRepository.findOne({
        where: { nombrePeriodo },
      });

      if (duplicado && duplicado.id !== catalogo.id) {
        throw new BadRequestException(
          `Ya existe un catálogo registrado con el periodo ${nombrePeriodo}`,
        );
      }

      catalogo.nombrePeriodo = nombrePeriodo;
    }

    if (dto.fechaRegistro !== undefined) {
      catalogo.fechaRegistro = new Date(dto.fechaRegistro);
    }

    const saved = await this.catalogosRepository.save(catalogo);
    return this.mapCatalogo(saved);
  }

  async deleteCatalogo(catalogoId: number) {
    await this.findCatalogoOrFail(catalogoId);
    await this.productosRepository.delete({ catalogoId });
    await this.catalogosRepository.delete(catalogoId);
    return { deleted: true, id: catalogoId };
  }

  async listProductos(query: ListProductosPromoMesDto) {
    const where = query.catalogoId ? { catalogoId: query.catalogoId } : {};
    const productos = await this.productosRepository.find({
      where,
      relations: { catalogo: true },
      order: {
        catalogoId: 'DESC',
        enCatalogo: 'DESC',
        paginaCatalogo: 'ASC',
        codigo: 'ASC',
      },
    });

    return productos.map((producto) => this.mapProductoAdmin(producto));
  }

  async getProducto(productoId: number) {
    const producto = await this.findProductoOrFail(productoId);
    return this.mapProductoAdmin(producto);
  }

  async createProducto(dto: CreateProductoPromoMesDto) {
    await this.findCatalogoOrFail(dto.catalogoId);
    const payload = await this.buildProductoPayload(dto);
    await this.ensureProductoUnico(payload.catalogoId, payload.codigo);

    const entity = this.productosRepository.create(payload);
    const saved = await this.productosRepository.save(entity);
    return this.getProducto(saved.id);
  }

  async updateProducto(productoId: number, dto: UpdateProductoPromoMesDto) {
    const producto = await this.findProductoOrFail(productoId);
    const payload = await this.buildProductoPayload(dto, producto);

    await this.ensureProductoUnico(
      payload.catalogoId,
      payload.codigo,
      producto.id,
    );

    producto.catalogoId = payload.catalogoId;
    producto.codigo = payload.codigo;
    producto.enCatalogo = payload.enCatalogo;
    producto.paginaCatalogo = payload.paginaCatalogo;
    producto.fueraDeCatalogo = payload.fueraDeCatalogo;

    const saved = await this.productosRepository.save(producto);
    return this.getProducto(saved.id);
  }

  async deleteProducto(productoId: number) {
    await this.findProductoOrFail(productoId);
    await this.productosRepository.delete(productoId);
    return { deleted: true, id: productoId };
  }

  async getProductosMesActual(options?: { includePendingCodes?: boolean }) {
    const catalogo = await this.findCurrentMonthCatalogo();

    if (!catalogo) {
      return {
        catalogo: null,
        productos: [],
        avisos: ['No hay productos nuevos registrados para el mes actual.'],
        resumen: {
          totalRegistrados: 0,
          totalDisponiblesLegacy: 0,
          totalPendientesLegacy: 0,
        },
      };
    }

    const productos = await this.productosRepository.find({
      where: { catalogoId: catalogo.id },
      order: { enCatalogo: 'DESC', paginaCatalogo: 'ASC', codigo: 'ASC' },
    });

    if (productos.length === 0) {
      return {
        catalogo: this.mapCatalogo(catalogo),
        productos: [],
        avisos: [
          'El catálogo del mes actual existe, pero todavía no tiene productos registrados.',
        ],
        resumen: {
          totalRegistrados: 0,
          totalDisponiblesLegacy: 0,
          totalPendientesLegacy: 0,
        },
      };
    }

    const legacyMap = await this.findLegacyProductsByCodes(
      productos.map((producto) => producto.codigo),
    );
    const disponibles: any[] = [];
    const pendientes: ProductoPromoMes[] = [];

    for (const producto of productos) {
      const legacy = legacyMap.get(this.normalizeCodigo(producto.codigo));
      if (!legacy) {
        pendientes.push(producto);
        continue;
      }

      disponibles.push(this.mapProductoMesActual(producto, legacy));
    }

    const avisos: string[] = [];
    if (disponibles.length === 0) {
      avisos.push(
        'Los productos del mes actual aún no han sido subidos en legacy.',
      );
    } else if (pendientes.length > 0) {
      avisos.push(this.buildPendingLegacyNotice(pendientes));
    }

    const response: Record<string, any> = {
      catalogo: this.mapCatalogo(catalogo),
      productos: disponibles,
      avisos,
      resumen: {
        totalRegistrados: productos.length,
        totalDisponiblesLegacy: disponibles.length,
        totalPendientesLegacy: pendientes.length,
      },
    };

    if (options?.includePendingCodes) {
      response.productosPendientesLegacy = pendientes.map((producto) => ({
        id: producto.id,
        codigo: producto.codigo,
        enCatalogo: producto.enCatalogo,
        paginaCatalogo: producto.paginaCatalogo,
        fueraDeCatalogo: producto.fueraDeCatalogo,
      }));
    }

    return response;
  }

  private async buildProductoPayload(
    dto: CreateProductoPromoMesDto | UpdateProductoPromoMesDto,
    current?: ProductoPromoMes,
  ) {
    const catalogoId = dto.catalogoId ?? current?.catalogoId;
    if (!catalogoId) {
      throw new BadRequestException('El catalogoId es requerido');
    }

    await this.findCatalogoOrFail(catalogoId);

    const codigo = this.normalizeCodigo(dto.codigo ?? current?.codigo);
    const enCatalogo = dto.enCatalogo ?? current?.enCatalogo ?? false;
    const fueraDeCatalogo =
      dto.fueraDeCatalogo ?? current?.fueraDeCatalogo ?? false;

    let paginaCatalogo =
      dto.paginaCatalogo !== undefined
        ? dto.paginaCatalogo
        : (current?.paginaCatalogo ?? null);

    if (!enCatalogo) {
      paginaCatalogo = null;
    }

    if (enCatalogo && (!paginaCatalogo || paginaCatalogo < 1)) {
      throw new BadRequestException(
        'La paginaCatalogo es requerida cuando enCatalogo es verdadero',
      );
    }

    return {
      catalogoId,
      codigo,
      enCatalogo,
      paginaCatalogo,
      fueraDeCatalogo,
    };
  }

  private async ensureProductoUnico(
    catalogoId: number,
    codigo: string,
    productoId?: number,
  ) {
    const existente = await this.productosRepository.findOne({
      where: { catalogoId, codigo },
    });

    if (existente && existente.id !== productoId) {
      throw new BadRequestException(
        `El código ${codigo} ya está registrado en ese catálogo`,
      );
    }
  }

  private async findCurrentMonthCatalogo() {
    const { start, end } = this.getCurrentMonthRange();
    return this.catalogosRepository
      .createQueryBuilder('catalogo')
      .where('catalogo.fecha_registro >= :start', { start })
      .andWhere('catalogo.fecha_registro <= :end', { end })
      .orderBy('catalogo.fecha_registro', 'DESC')
      .addOrderBy('catalogo.id', 'DESC')
      .getOne();
  }

  private async findLegacyProductsByCodes(codes: string[]) {
    const normalizedCodes = Array.from(
      new Set(
        codes
          .map((code) => this.normalizeCodigo(code))
          .filter((code) => code.length > 0),
      ),
    );

    const legacyMap = new Map<string, LegacyProductoMes>();
    if (normalizedCodes.length === 0) {
      return legacyMap;
    }

    const placeholders = normalizedCodes.map(() => '?').join(', ');
    const rows = await this.legacyDataSource.query(
      `
        SELECT
          inv.ARTICULOID AS articuloId,
          TRIM(COALESCE(inv.CLAVE, '')) AS clave,
          TRIM(COALESCE(inv.CLVPROV, '')) AS codigoProveedor,
          TRIM(COALESCE(inv.DESCRIPCIO, '')) AS descripcion,
          TRIM(COALESCE(inv.XXMARCA, '')) AS marca,
          TRIM(COALESCE(inv.XIMAGEN2, '')) AS imagen
        FROM INV inv
        WHERE TRIM(COALESCE(inv.CLAVE, '')) IN (${placeholders})
           OR TRIM(COALESCE(inv.CLVPROV, '')) IN (${placeholders})
      `,
      [...normalizedCodes, ...normalizedCodes],
    );

    for (const row of rows) {
      const legacy: LegacyProductoMes = {
        articuloId: this.toNumber(row.articuloId),
        clave: this.cleanNullableString(row.clave),
        codigoProveedor: this.cleanNullableString(row.codigoProveedor),
        descripcion: this.cleanNullableString(row.descripcion),
        marca: this.cleanNullableString(row.marca),
        imagen: this.buildCatalogImageUrl(row.imagen),
      };

      const candidateCodes = [legacy.clave, legacy.codigoProveedor]
        .map((code) => this.cleanNullableString(code))
        .filter((code): code is string => Boolean(code));

      for (const code of candidateCodes) {
        if (!legacyMap.has(code)) {
          legacyMap.set(code, legacy);
        }
      }
    }

    return legacyMap;
  }

  private mapCatalogo(catalogo: CatalogoPromoMes) {
    return {
      id: catalogo.id,
      nombrePeriodo: catalogo.nombrePeriodo,
      fechaRegistro: this.toIsoString(catalogo.fechaRegistro),
    };
  }

  private mapProductoAdmin(producto: ProductoPromoMes) {
    return {
      id: producto.id,
      catalogoId: producto.catalogoId,
      catalogo: producto.catalogo ? this.mapCatalogo(producto.catalogo) : null,
      codigo: producto.codigo,
      enCatalogo: producto.enCatalogo,
      paginaCatalogo: producto.paginaCatalogo,
      fueraDeCatalogo: producto.fueraDeCatalogo,
      createdAt: this.toIsoString(producto.createdAt),
      updatedAt: this.toIsoString(producto.updatedAt),
    };
  }

  private mapProductoMesActual(
    producto: ProductoPromoMes,
    legacy: LegacyProductoMes,
  ) {
    return {
      id: producto.id,
      codigo: producto.codigo,
      enCatalogo: producto.enCatalogo,
      paginaCatalogo: producto.paginaCatalogo,
      fueraDeCatalogo: producto.fueraDeCatalogo,
      legacy: {
        articuloId: legacy.articuloId,
        clave: legacy.clave,
        codigoProveedor: legacy.codigoProveedor,
        descripcion: legacy.descripcion,
        marca: legacy.marca,
        imagen: legacy.imagen,
      },
    };
  }

  private buildPendingLegacyNotice(productos: ProductoPromoMes[]) {
    const sampleCodes = productos
      .slice(0, 10)
      .map((producto) => producto.codigo)
      .join(', ');

    const suffix = productos.length > 10 ? ', ...' : '';
    return `Algunos productos aún no han sido subidos en legacy y no se mostrarán en la app (${sampleCodes}${suffix}).`;
  }

  private async findCatalogoOrFail(catalogoId: number) {
    const catalogo = await this.catalogosRepository.findOne({
      where: { id: catalogoId },
    });

    if (!catalogo) {
      throw new NotFoundException(`No se encontró el catálogo ${catalogoId}`);
    }

    return catalogo;
  }

  private async findProductoOrFail(productoId: number) {
    const producto = await this.productosRepository.findOne({
      where: { id: productoId },
      relations: { catalogo: true },
    });

    if (!producto) {
      throw new NotFoundException(`No se encontró el producto ${productoId}`);
    }

    return producto;
  }

  private normalizePeriodo(value: string | null | undefined) {
    const normalized = (value ?? '').trim();
    if (!normalized) {
      throw new BadRequestException('El nombrePeriodo es requerido');
    }

    return normalized;
  }

  private normalizeCodigo(value: string | null | undefined) {
    const normalized = (value ?? '').trim();
    if (!normalized) {
      throw new BadRequestException('El codigo es requerido');
    }

    return normalized;
  }

  private getCurrentMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { start, end };
  }

  private toIsoString(value: Date | null | undefined) {
    return value ? new Date(value).toISOString() : null;
  }

  private cleanNullableString(value: string | null | undefined) {
    const cleanValue = (value ?? '').trim();
    return cleanValue ? cleanValue : null;
  }

  private buildCatalogImageUrl(
    imageName: string | null | undefined,
  ): string | null {
    const cleanImageName = this.cleanNullableString(imageName);
    if (!cleanImageName) {
      return null;
    }

    const baseUrl = this.catalogImageBaseUrl.endsWith('/')
      ? this.catalogImageBaseUrl
      : `${this.catalogImageBaseUrl}/`;

    const fileName = cleanImageName.replace(/\.[^.]+$/i, '.webp');
    return `${baseUrl}${encodeURIComponent(fileName)}`;
  }

  private toNumber(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }
}
