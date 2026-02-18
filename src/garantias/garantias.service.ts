import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, In, Between } from 'typeorm';
import { Garantia, HistorialEstatusGarantia, MediaGarantia, EstatusGarantia } from '../entities/garantia.entity';
import { CreateGarantiaDto, UpdateStatusDto } from './garantias.dto';
import { WhatsappService } from './whatsapp.service';
import { EventsGateway } from '../events/events.gateway';
import { Cliente } from '../entities/cliente.entity';
import { Producto } from '../entities';

@Injectable()
export class GarantiasService {
  private readonly logger = new Logger(GarantiasService.name);

  constructor(
    @InjectRepository(Garantia)
    private readonly garantiaRepo: Repository<Garantia>,
    @InjectRepository(HistorialEstatusGarantia)
    private readonly historialRepo: Repository<HistorialEstatusGarantia>,
    @InjectRepository(MediaGarantia)
    private readonly mediaRepo: Repository<MediaGarantia>,
    
    @InjectRepository(Cliente, 'legacy_db')
    private readonly clienteRepo: Repository<Cliente>,

    @InjectDataSource('legacy_db')
    private readonly legacyDataSource: DataSource,

    private readonly whatsappService: WhatsappService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  // Crear nueva garantía
  async create(createDto: CreateGarantiaDto) {
    const { clienteId, productoId, facturaId, descripcionFalla, telefonoContacto, nombreContacto } = createDto;

    // Generar Folio Único (ej. GAR-TIMESTAMP-RANDOM)
    const folio = `GAR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const nuevaGarantia = this.garantiaRepo.create({
      folio,
      clienteId,
      productoId,
      facturaId,
      descripcionFalla,
      telefonoContacto,
      nombreContacto,
      estatusActual: EstatusGarantia.PENDIENTE_REVISION,
    });

    const saved = await this.garantiaRepo.save(nuevaGarantia);

    // Registrar historial inicial
    const historial = this.historialRepo.create({
      garantia: saved,
      estatusAnterior: null as unknown as EstatusGarantia,
      estatusNuevo: EstatusGarantia.PENDIENTE_REVISION,
      usuarioResponsable: nombreContacto || 'SISTEMA',
      comentario: 'Registro inicial de garantía',
    });
    await this.historialRepo.save(historial);

    // Emitir WebSocket
    this.eventsGateway.emitirCambioGarantia({
      id: saved.id,
      folio: saved.folio,
      nuevoEstatus: EstatusGarantia.PENDIENTE_REVISION,
      fecha: new Date(),
    });

    return saved;
  }

  // Obtener todas (paginadas)
  async findAll(page: number = 1, limit: number = 50) {
    return this.garantiaRepo.find({
      take: limit,
      skip: (page - 1) * limit,
      order: { fechaCreacion: 'DESC' },
      relations: ['cliente', 'producto', 'media'],
    });
  }

  // Obtener garantías de los últimos 30 días
  async findLast30Days() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    return this.garantiaRepo.find({
      where: {
        fechaCreacion: Between(thirtyDaysAgo, today),
      },
      order: { fechaCreacion: 'DESC' },
      relations: ['cliente', 'producto'],
    });
  }

  async findOne(id: number) {
    const garantia = await this.garantiaRepo.findOne({
      where: { id },
      relations: ['cliente', 'producto', 'historial', 'media'],
    });
    if (!garantia) throw new NotFoundException(`Garantía con ID ${id} no encontrada`);
    return garantia;
  }

  // Cambio de estatus
  async updateStatus(id: number, updateDto: UpdateStatusDto) {
    const { nuevoEstatus, comentario, usuarioResponsable } = updateDto;

    const garantia = await this.findOne(id);
    const estatusAnterior = garantia.estatusActual;

    if (estatusAnterior === nuevoEstatus) {
      return garantia; // No hay cambio
    }

    // Actualizar estatus
    garantia.estatusActual = nuevoEstatus;
    await this.garantiaRepo.save(garantia);

    // Registrar historial
    const historial = this.historialRepo.create({
      garantia,
      estatusAnterior: estatusAnterior || (null as unknown as EstatusGarantia),
      estatusNuevo: nuevoEstatus,
      usuarioResponsable: usuarioResponsable || 'SISTEMA',
      comentario: comentario || '',
    });
    await this.historialRepo.save(historial);

    // Emitir WebSocket
    this.eventsGateway.emitirCambioGarantia({
      id: garantia.id,
      folio: garantia.folio,
      nuevoEstatus,
      fecha: new Date(),
    });

    // Enviar WhatsApp
    await this.notificarCliente(garantia, nuevoEstatus);

    return garantia;
  }

  // Lógica de notificación
  private async notificarCliente(garantia: Garantia, nuevoEstatus: string) {
    try {
      let telefono = garantia.telefonoContacto;
      let nombre = garantia.nombreContacto;

      // Si es cliente registrado y no tenemos contacto directo, buscamos en DB Cliente
      if (garantia.clienteId && (!telefono || !nombre)) {
         // NOTA: Como la entidad Cliente no tiene campo explícito de teléfono,
         // aquí usaríamos un campo si existiera. Por ahora usamos el del registro de garantía.
         // Si quisiéramos buscar en otra tabla (ej. ContactosCliente), lo haríamos aquí.
         
         // Intentar obtener nombre del cliente si no está definido
         if (!nombre) {
             const cliente = await this.clienteRepo.findOne({ where: { clienteId: garantia.clienteId } });
             if (cliente) nombre = cliente.nombre;
         }
      }

      if (telefono && nombre) {
        await this.whatsappService.sendStatusUpdate(telefono, nombre, garantia.folio, nuevoEstatus);
      } else {
        this.logger.warn(`No se pudo enviar WhatsApp para garantía ${garantia.folio}: Falta teléfono o nombre.`);
      }
    } catch (error) {
      this.logger.error(`Error enviando notificación WhatsApp para garantía ${garantia.id}`, error);
    }
  }

  // Buscar facturas en Legacy DB por SKU y Cliente
  async findFacturasPorProducto(codigo: string, clienteId: number) {
    // Consulta a tablas DOC (Facturas), DES (Detalles), INV (Inventario)
    // Asumimos que codigo = CLVPROV
    const query = `
      SELECT 
        D.DOCID, 
        D.NUMERO AS FOLIO, 
        D.FECHA, 
        D.TOTAL,
        I.CLVPROV AS CODIGO,
        I.DESCRIPCIO AS PRODUCTO,
        DS.DESCANTIDAD AS CANTIDAD
      FROM DOC D
      JOIN DES DS ON D.DOCID = DS.DESDOCID
      JOIN INV I ON DS.DESARTID = I.ARTICULOID
      WHERE D.CLIENTEID = ? 
      AND I.CLVPROV = ? 
      AND D.TIPO = 'F' -- Solo Facturas
      AND D.ESTADO != 'C' -- No canceladas
      ORDER BY D.FECHA DESC
      LIMIT 20
    `;

    const resultados = await this.legacyDataSource.query(query, [clienteId, codigo]);
    return resultados;
  }

  // Agregar Media (Fotos/Videos)
  async addMedia(garantiaId: number, url: string, tipo: string) {
    const media = this.mediaRepo.create({
      garantiaId,
      url,
      tipoArchivo: tipo,
    });
    return await this.mediaRepo.save(media);
  }
}
