import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DetallePedido, Pedido, StatusGlobal, StatusLinea, Surtido, Zona, StatusEntrega } from 'src/entities';
import { In, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { EventsGateway } from 'src/events/events.gateway';
import { ActualizarLineaDto, AsignarPedidoDto, AsignarSiguienteDto, EmpaquetarPedidoDto, FinalizarEtapaDto } from './dto/pedidos.dto';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    @InjectRepository(Pedido) private pedidoRepo: Repository<Pedido>,
    @InjectRepository(DetallePedido) private detalleRepo: Repository<DetallePedido>,
    @InjectRepository(Surtido) private surtidoRepo: Repository<Surtido>,
    private eventsGateway: EventsGateway,
  ) {}

  private async logPedidoFechaTrace(contexto: string, pedidoId: number) {
    const pedido = await this.pedidoRepo.findOne({
      where: { id: pedidoId },
      select: ['id', 'statusGlobal', 'fechaInicioCc', 'fechaFinCc', 'fechaInicioAg', 'fechaFinAg'],
    });

    this.logger.warn(JSON.stringify({
      contexto,
      pedidoId,
      procesoAhora: new Date().toString(),
      procesoIso: new Date().toISOString(),
      pedido,
    }));
  }

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

  getPedidosCompletadosByAlmacenista(id: number) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return this.pedidoRepo.find({
      where: [
        {
          surtidorCcId: id,
          fechaFinCc: MoreThanOrEqual(hoy),
        },
        {
          surtidorAgId: id,
          fechaFinAg: MoreThanOrEqual(hoy),
        },
      ],
      relations: ['surtidorCc', 'surtidorAg', 'detalles', 'detalles.producto', 'detalles.producto.codigos'],
      order: { fechaCreacion: 'DESC' },
    });
  }

  getDetalle(id: number) {
    return this.pedidoRepo.findOne({
      where: { id },
      relations: ['detalles', 'detalles.producto', 'detalles.producto.codigos'],
    });
  }

  getPedidosRecogeEnOficina() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return this.pedidoRepo.find({
      where: {
        esRecogeEnOficina: true,
        statusGlobal: Not(StatusGlobal.CANCELADO),
        fechaCreacion: MoreThanOrEqual(hoy),
      },
      order: { fechaCreacion: 'DESC' },
    });
  }

  // --- OPERACIONES ---

  async asignarUsuario(id: number, dto: AsignarPedidoDto) {
    const pedido = await this.pedidoRepo.findOne({
      where: { idExternoDoc: id },
      relations: ['detalles'],
    });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    // Verificar si ya está asignado en esa zona para evitar duplicar el registro en surtido
    const yaEstabaAsignadoCC = pedido.surtidorCcId !== null;
    const yaEstabaAsignadoAG = pedido.surtidorAgId !== null;

    if (dto.zona === 'CC') {
      pedido.surtidorCcId = dto.userId;
      pedido.fechaInicioCc = new Date();
      pedido.statusGlobal = StatusGlobal.EN_SURTIDO_CC;

      await this.pedidoRepo.update(
        { idExternoDoc: id },
        {
          surtidorCcId: dto.userId,
          fechaInicioCc: new Date(),
          statusGlobal: StatusGlobal.EN_SURTIDO_CC,
        },
      );
      await this.logPedidoFechaTrace('asignarUsuario_CC', pedido.id);
    } else {
      pedido.surtidorAgId = dto.userId;
      pedido.fechaInicioAg = new Date();
      pedido.statusGlobal = StatusGlobal.EN_SURTIDO_AG;

      await this.pedidoRepo.update(
        { idExternoDoc: id },
        {
          surtidorAgId: dto.userId,
          fechaInicioAg: new Date(),
          statusGlobal: StatusGlobal.EN_SURTIDO_AG,
        },
      );
      await this.logPedidoFechaTrace('asignarUsuario_AG', pedido.id);
    }
    const actualizado = await this.pedidoRepo.findOne({
      where: { idExternoDoc: id },
      relations: ['detalles'],
    });
    if (!actualizado) throw new NotFoundException('Pedido no encontrado');

    // Solo creamos el registro en la tabla de surtido si es la primera vez que se asigna en esa zona
    const debeRegistrarSurtido = (dto.zona === 'CC' && !yaEstabaAsignadoCC) || (dto.zona === 'AG' && !yaEstabaAsignadoAG);

    if (debeRegistrarSurtido) {
      try {
        // Calculamos partidas (items únicos) que corresponden a la zona
        const zonaTarget = dto.zona === 'CC' ? Zona.CC : Zona.AG;
        const partidasCount = pedido.detalles.filter((d) => d.zonaSurtido === zonaTarget).length;

        // Obtener la fecha y hora actual (ya ajustada globalmente por TZ)
        const now = new Date();
        const pad = (num: number) => num.toString().padStart(2, '0');
        
        const fechaLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const horaLocal = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        const surtido = this.surtidoRepo.create({
          idAlmacenista: dto.userId,
          fecha: fechaLocal,
          hora: horaLocal,
          partidas: partidasCount,
          pedido: parseInt(pedido.folioExterno),
          lugar: dto.zona === 'CC' ? 'cc' : 'al',
          serie: pedido.serie,
        });

        await this.surtidoRepo.save(surtido);
      } catch (error) {
        this.logger.error('Error al guardar en tabla surtido', error);
      }
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

      await this.pedidoRepo.update(
        { id: pedido.id },
        {
          surtidorAgId: dto.userId,
          fechaInicioAg: new Date(),
          statusGlobal: StatusGlobal.EN_SURTIDO_AG,
        },
      );
      await this.logPedidoFechaTrace('asignarSiguienteDisponible_AG', pedido.id);
    }
    const pedidoAsignado = await this.pedidoRepo.findOne({ where: { id: pedido.id } });
    if (!pedidoAsignado) {
      throw new NotFoundException('No hay pedidos disponibles en este momento.');
    }

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

    // COMENTADO TEMPORALMENTE: TODO SE MARCA COMO COMPLETADO EN AG POR AHORA
    /*
    if (dto.zona === 'CC') {
      pedido.fechaFinCc = new Date();
      const tieneItemsAG = pedido.detalles.some((d) => d.zonaSurtido === Zona.AG);

      if (tieneItemsAG) {
        pedido.statusGlobal = StatusGlobal.PENDIENTE_AG;

        await this.pedidoRepo.update(
          { id },
          {
            fechaFinCc: new Date(),
            statusGlobal: StatusGlobal.PENDIENTE_AG,
          },
        );
        await this.logPedidoFechaTrace('finalizarEtapa_CC_pendiente_ag', pedido.id);
      } else {
        pedido.statusGlobal = StatusGlobal.COMPLETADO;

        await this.pedidoRepo.update(
          { id },
          {
            fechaFinCc: new Date(),
            statusGlobal: StatusGlobal.COMPLETADO,
          },
        );
        await this.logPedidoFechaTrace('finalizarEtapa_CC_completado', pedido.id);
      }
    } else if (dto.zona === 'AG') {
    */

    // Lógica forzada actual (Todo cuenta como AG y termina el pedido)
    pedido.fechaFinAg = new Date();
    if (dto.zona === 'CC') {
      pedido.fechaFinCc = new Date();
    }
    pedido.statusGlobal = StatusGlobal.COMPLETADO;

    await this.pedidoRepo.update(
      { id },
      {
        fechaFinAg: new Date(),
        ...(dto.zona === 'CC' && { fechaFinCc: new Date() }),
        statusGlobal: StatusGlobal.COMPLETADO,
      },
    );
    await this.logPedidoFechaTrace(dto.zona === 'CC' ? 'finalizarEtapa_CC_forzado_AG' : 'finalizarEtapa_AG', pedido.id);
    
    /* } */ // Fin del bloque COMENTADO TEMPORALMENTE

    const guardado = await this.pedidoRepo.findOne({
      where: { id },
      relations: ['detalles'],
    });
    if (!guardado) throw new NotFoundException('Pedido no encontrado');

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
    
    // Si el pedido es para recoger en oficina, se actualiza el estado de entrega
    if (pedido.esRecogeEnOficina) {
      pedido.statusEntrega = StatusEntrega.DISPONIBLE_OFICINA;
      this.eventsGateway.emitirCambioStatusEntrega({ idPedido: id, nuevoStatusEntrega: StatusEntrega.DISPONIBLE_OFICINA });
    }

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

  async actualizarStatusEntrega(id: number, nuevoStatus: StatusEntrega) {
    const pedido = await this.pedidoRepo.findOne({ where: { id } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    if (!pedido.esRecogeEnOficina) {
      throw new BadRequestException('Este pedido no está marcado como Recoge en Oficina');
    }

    pedido.statusEntrega = nuevoStatus;
    const actualizado = await this.pedidoRepo.save(pedido);

    this.eventsGateway.emitirCambioStatusEntrega({ idPedido: id, nuevoStatusEntrega: nuevoStatus });

    return actualizado;
  }

  async cleanupDuplicates() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Buscar duplicados agrupando por pedido y producto, filtrando por fecha de creación del pedido >= hoy
    const duplicadosRaw = await this.detalleRepo.query(`
      SELECT dp.pedido_id, dp.producto_id, COUNT(*) as c
      FROM detalle_pedidos dp
      JOIN pedidos p ON dp.pedido_id = p.id
      WHERE p.fecha_creacion >= ?
      GROUP BY dp.pedido_id, dp.producto_id
      HAVING c > 1
    `, [hoy]);

    let totalEliminados = 0;

    for (const dup of duplicadosRaw) {
      // Obtener todos los registros de ese producto en ese pedido
      const lineas = await this.detalleRepo.find({
        where: { 
          pedido: { id: dup.pedido_id }, 
          producto: { id: dup.producto_id } 
        },
        order: { 
          cantidadSurtida: 'DESC', // Preferimos el que ya tenga avance (mayor cantidad surtida)
          id: 'ASC'                // Si hay empate, preservamos el registro más antiguo (menor ID)
        }
      });

      if (lineas.length > 1) {
        // El primero de la lista es el que conservamos
        const [original, ...restantes] = lineas;
        
        for (const r of restantes) {
          await this.detalleRepo.delete(r.id);
          totalEliminados++;
        }
      }
    }

    return { message: `Se eliminaron ${totalEliminados} registros duplicados de detalle_pedidos (del día actual).` };
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
