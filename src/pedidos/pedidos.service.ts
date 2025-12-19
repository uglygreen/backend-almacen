import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DetallePedido, Pedido, StatusGlobal, StatusLinea, Surtido, Zona } from 'src/entities';
import { In, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { EventsGateway } from 'src/events/events.gateway';
import { ActualizarLineaDto, AsignarPedidoDto, AsignarSiguienteDto, EmpaquetarPedidoDto, FinalizarEtapaDto } from './dto/pedidos.dto';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

@Injectable()
export class PedidosService {
  constructor(
    @InjectRepository(Pedido) private pedidoRepo: Repository<Pedido>,
    @InjectRepository(DetallePedido) private detalleRepo: Repository<DetallePedido>,
    @InjectRepository(Surtido) private surtidoRepo: Repository<Surtido>,
    private eventsGateway: EventsGateway,
  ) {}

  // --- CONSULTAS ---

  getPedidosCC() {
    return this.pedidoRepo.find({
      where: {
        statusGlobal: StatusGlobal.ESPERA_CC,
        requiereCuartoChico: true,
      },
      order: { fechaCreacion: 'ASC' },
    });
  }

  getPedidosAG() {
    return this.pedidoRepo.find({
      where: {
        statusGlobal: StatusGlobal.PENDIENTE_AG,
      },
      relations: ['surtidorCc'],
      order: { fechaCreacion: 'ASC' },
    });
  }

  getPedidosEnSurtido() {
    return this.pedidoRepo.find({
      where: {
        statusGlobal: In([StatusGlobal.EN_SURTIDO_CC, StatusGlobal.EN_SURTIDO_AG]),
      },
      relations: ['surtidorCc', 'surtidorAg'],
      order: { fechaCreacion: 'ASC' },
    });
  }
  getPedidosEnSurtidoById(id: number) {
    return this.pedidoRepo.find({
      where: [
        {
          surtidorCcId: id,
          statusGlobal: StatusGlobal.EN_SURTIDO_CC,
        },
        {
          surtidorAgId: id,
          statusGlobal: StatusGlobal.EN_SURTIDO_AG,
        },
      ],
      relations: ['surtidorCc', 'surtidorAg','detalles', 'detalles.producto', 'detalles.producto.codigos'],
      order: { fechaCreacion: 'ASC' },
    });
  }
  getPedidosCompletadosHoy() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return this.pedidoRepo.find({
      where: [
        {
          statusGlobal: StatusGlobal.COMPLETADO,
          fechaFinAg: MoreThanOrEqual(hoy),
        },
        {
          statusGlobal: StatusGlobal.COMPLETADO,
          fechaFinCc: MoreThanOrEqual(hoy),
          fechaFinAg: IsNull(),
        },
      ],
      relations: ['surtidorCc', 'surtidorAg'],
      order: { fechaFinAg: 'DESC', fechaFinCc: 'DESC' },
    });
  }

  getDetalle(id: number) {
    return this.pedidoRepo.findOne({
      where: { id },
      relations: ['detalles', 'detalles.producto', 'detalles.producto.codigos'],
    });
  }

  // --- OPERACIONES ---

  async asignarUsuario(id: number, dto: AsignarPedidoDto) {
    const pedido = await this.pedidoRepo.findOne({
      where: { idExternoDoc: id },
      relations: ['detalles'],
    });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    if (dto.zona === 'CC') {
      pedido.surtidorCcId = dto.userId;
      pedido.fechaInicioCc = new Date();
      pedido.statusGlobal = StatusGlobal.EN_SURTIDO_CC;
    } else {
      pedido.surtidorAgId = dto.userId;
      pedido.fechaInicioAg = new Date();
      pedido.statusGlobal = StatusGlobal.EN_SURTIDO_AG;
    }

    const actualizado = await this.pedidoRepo.save(pedido);

    try {
      // Calculamos partidas (items únicos) que corresponden a la zona
      // Nota: Si se requiere el total del pedido independientemente de la zona, quitar el filtro.
      // Pero dado que 'lugar' es específico ('cc' o 'al'), filtramos por zona.
      const zonaTarget = dto.zona === 'CC' ? Zona.CC : Zona.AG;
      const partidasCount = pedido.detalles.filter((d) => d.zonaSurtido === zonaTarget).length;
      // Si no hay partidas para esa zona (raro si se asigna), podría ser 0.
      // Si el usuario quiere TODO el pedido: const partidasCount = pedido.detalles.length;

      const surtido = this.surtidoRepo.create({
        idAlmacenista: dto.userId,
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().split(' ')[0],
        partidas: partidasCount,
        pedido: parseInt(pedido.folioExterno),
        lugar: dto.zona === 'CC' ? 'cc' : 'al',
        serie: pedido.serie,
      });

      await this.surtidoRepo.save(surtido);
    } catch (error) {
      console.error('Error al registrar en tabla surtido:', error);
    }

    this.eventsGateway.emitirCambioEstado({ idPedido: id, nuevoEstado: pedido.statusGlobal });

    return actualizado;
  }

  async asignarSiguienteDisponible(dto: AsignarSiguienteDto) {
    const pedido = await this.pedidoRepo.findOne({
      where: {
        statusGlobal: In([StatusGlobal.PENDIENTE_AG]),
      },
      order: {
        fechaCreacion: 'ASC',
      },
    });

    if (!pedido) {
      throw new NotFoundException('No hay pedidos disponibles en este momento.');
    }

    if (pedido.statusGlobal === StatusGlobal.PENDIENTE_AG) {
      pedido.surtidorAgId = dto.userId;
      pedido.fechaInicioAg = new Date();
      pedido.statusGlobal = StatusGlobal.EN_SURTIDO_AG;
    }

    const pedidoAsignado = await this.pedidoRepo.save(pedido);

    this.eventsGateway.emitirCambioEstado({
      idPedido: pedidoAsignado.id,
      nuevoEstado: pedidoAsignado.statusGlobal,
    });

    return pedidoAsignado;
  }

  async actualizarLinea(id: number, dto: ActualizarLineaDto) {
    const linea = await this.detalleRepo.findOne({ where: { id } });
    if (!linea) throw new NotFoundException('Línea no encontrada');

    linea.cantidadSurtida = dto.cantidadSurtida;
    linea.notaIncidencia = dto.nota ?? '';

    if (linea.cantidadSurtida === 0) {
      linea.statusLinea = StatusLinea.NO_ENCONTRADO;
    } else if (linea.cantidadSurtida < linea.cantidadSolicitada) {
      linea.statusLinea = StatusLinea.PARCIAL;
    } else {
      linea.statusLinea = StatusLinea.COMPLETADO;
    }

    return this.detalleRepo.save(linea);
  }

  async finalizarEtapa(id: number, dto: FinalizarEtapaDto) {
    const pedido = await this.pedidoRepo.findOne({
      where: { id },
      relations: ['detalles'],
    });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    if (dto.zona === 'CC') {
      pedido.fechaFinCc = new Date();

      const tieneItemsAG = pedido.detalles.some((d) => d.zonaSurtido === Zona.AG);

      if (tieneItemsAG) {
        pedido.statusGlobal = StatusGlobal.PENDIENTE_AG;
      } else {
        pedido.statusGlobal = StatusGlobal.COMPLETADO;
      }
    } else if (dto.zona === 'AG') {
      pedido.fechaFinAg = new Date();
      pedido.statusGlobal = StatusGlobal.COMPLETADO;
    }

    const guardado = await this.pedidoRepo.save(pedido);

    if (guardado.statusGlobal === StatusGlobal.PENDIENTE_AG) {
      this.eventsGateway.emitirNuevoPedido(guardado);
    } else {
      this.eventsGateway.emitirCambioEstado({ idPedido: id, nuevoEstado: guardado.statusGlobal });
    }

    return guardado;
  }

  async marcarComoEmpaquetadoYGenerarTickets(id: number, dto: EmpaquetarPedidoDto): Promise<Buffer> {
    const pedido = await this.pedidoRepo.findOne({ where: { id } });
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (pedido.statusGlobal !== StatusGlobal.COMPLETADO) {
      throw new BadRequestException(`El pedido no se puede marcar como empaquetado porque su estado actual es '${pedido.statusGlobal}'`);
    }

    pedido.statusGlobal = StatusGlobal.EMPAQUETADO;
    await this.pedidoRepo.save(pedido);

    this.eventsGateway.emitirCambioEstado({ idPedido: id, nuevoEstado: StatusGlobal.EMPAQUETADO });

    // --- Generación del PDF ---
    const pdfBuffer = await this.generarPdfTickets(pedido, dto.numeroDeBultos);
    return pdfBuffer;
  }

  private async generarPdfTickets(pedido: Pedido, numeroDeBultos: number): Promise<Buffer> {
    const doc = new PDFDocument({
      size: [226, 400], // Ancho y alto en puntos (8cm ~ 226pt)
      margins: { top: 10, bottom: 10, left: 15, right: 15 },
    });

    for (let i = 1; i <= numeroDeBultos; i++) {
      if (i > 1) {
        doc.addPage();
      }
      await this.crearTicket(doc, pedido, i, numeroDeBultos);
    }

    // Convertir el PDF a un Buffer en memoria
    return new Promise((resolve) => {
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.end();
    });
  }

  private async crearTicket(doc: PDFKit.PDFDocument, pedido: Pedido, bultoActual: number, totalBultos: number) {
    doc.save(); // Guardamos el estado actual para no afectar otras páginas

    // Rotamos el lienzo -90 grados y lo trasladamos para que el origen (0,0)
    // quede en la nueva esquina superior izquierda.
    doc.rotate(-90, { origin: [0, 0] });
    doc.translate(-doc.page.height, 0);

    // Las dimensiones efectivas ahora están intercambiadas.
    const newWidth = doc.page.height;
    const newHeight = doc.page.width;

    const yInicial = doc.y;

    // Título y número de bulto en la misma "fila"
    doc.fontSize(16).font('Helvetica-Bold').text('FERREMAYORISTAS DEL BAJIO', 0, yInicial, { width: newWidth, align: 'center' });
    doc.fontSize(12).font('Helvetica-Bold').text(`${bultoActual}/${totalBultos}`, 0, yInicial + 2, { width: newWidth - 20, align: 'right' });
    doc.moveDown(1);

    // Folio y fecha en la misma "fila"
    const yFolio = doc.y;
    doc.fontSize(10).font('Helvetica').text(`Pedido: ${pedido.serie}-${pedido.folioExterno}`, 0, yFolio, { width: newWidth, align: 'center' });
    const fecha = new Date().toLocaleString('es-MX');
    doc.fontSize(8).font('Helvetica-Oblique').text(fecha, 0, yFolio + 1, { width: newWidth - 20, align: 'right' });
    doc.moveDown(2);

    // Cliente centrado
    doc.fontSize(12).font('Helvetica-Bold').text('CLIENTE:', { align: 'center' });
    doc.font('Helvetica').text(`${pedido.clienteNombre}`, { align: 'center' });
    doc.moveDown(2);

    // --- Generación y adición del código de barras ---
    const barcodeText = `${pedido.serie}-${pedido.folioExterno}`;
    const pngBuffer = await bwipjs.toBuffer({
      bcid: 'code128', // Tipo de código de barras
      text: barcodeText, // Texto a codificar
      scale: 2, // Escala
      height: 10, // Altura en mm
      includetext: true, // Incluir texto legible
      textxalign: 'center', // Alineación del texto
    });

    // Centramos la imagen del código de barras
    const barcodeWidth = 180;
    doc.image(pngBuffer, (newWidth - barcodeWidth) / 2, doc.y, { width: barcodeWidth, align: 'center' });
    doc.moveDown(1);

    

    doc.restore(); // Restauramos el estado original
  }
}
