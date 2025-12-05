import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DetallePedido, Pedido, StatusGlobal, StatusLinea, Zona } from 'src/entities';
import { In, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { EventsGateway } from 'src/events/events.gateway';
import { ActualizarLineaDto, AsignarPedidoDto, AsignarSiguienteDto, EmpaquetarPedidoDto, FinalizarEtapaDto } from './dto/pedidos.dto';
import PDFDocument from 'pdfkit';

@Injectable()
export class PedidosService {
  constructor(
    @InjectRepository(Pedido) private pedidoRepo: Repository<Pedido>,
    @InjectRepository(DetallePedido) private detalleRepo: Repository<DetallePedido>,
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
      relations: ['surtidorCc', 'surtidorAg'],
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
    const pedido = await this.pedidoRepo.findOne({ where: { id } });
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

  private generarPdfTickets(pedido: Pedido, numeroDeBultos: number): Promise<Buffer> {    
    const doc = new PDFDocument({
      size: [226, 400], // Ancho y alto en puntos (8cm ~ 226pt)
      margins: { top: 10, bottom: 10, left: 15, right: 15 },
    });

    for (let i = 1; i <= numeroDeBultos; i++) {
      if (i > 1) {
        doc.addPage();
      }
      this.crearTicket(doc, pedido, i, numeroDeBultos);
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

  private crearTicket(doc: PDFKit.PDFDocument, pedido: Pedido, bultoActual: number, totalBultos: number) {
    doc.fontSize(16).font('Helvetica-Bold').text('FERREMAYORISTAS DEL BAJIO', { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica').text(`Pedido: ${pedido.serie}-${pedido.folioExterno}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(12).font('Helvetica-Bold').text('CLIENTE:', { continued: true }).font('Helvetica').text(` ${pedido.clienteNombre}`);
    doc.moveDown(1);

    doc.fontSize(28).font('Helvetica-Bold').text(`${bultoActual}/${totalBultos}`, { align: 'center' });
    doc.moveDown(1);

    const fecha = new Date().toLocaleString('es-MX');
    doc.fontSize(8).font('Helvetica-Oblique').text(fecha, { align: 'center' });
  }
}
