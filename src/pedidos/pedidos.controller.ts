import { Controller, Get, Post, Body, Patch, Param, Delete, NotFoundException } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { DetallePedido, Pedido, StatusGlobal, StatusLinea, Zona } from 'src/entities';
import { In, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ActualizarLineaDto, AsignarPedidoDto, AsignarSiguienteDto, FinalizarEtapaDto } from './dto/pedidos.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventsGateway } from 'src/events/events.gateway';



@ApiTags('Pedidos') // Etiqueta para Swagger
@Controller('pedidos')
export class PedidosController {
  constructor(
    @InjectRepository(Pedido) private pedidoRepo: Repository<Pedido>,
    @InjectRepository(DetallePedido) private detalleRepo: Repository<DetallePedido>,
    private eventsGateway: EventsGateway // Inyectamos el socket
  ) {}

  // -----------------------------------------------------
  // 1. CONSULTAS (GET)
  // -----------------------------------------------------

  @Get('cuarto-chico')
  @ApiOperation({ summary: 'Obtener lista de espera para Cuarto Chico' })
  async getPedidosCC() {
    return this.pedidoRepo.find({
      where: {
        statusGlobal: StatusGlobal.ESPERA_CC,
        requiereCuartoChico: true,
      },
      order: { fechaCreacion: 'ASC' }
    });
  }

  @Get('almacen-general')
  @ApiOperation({ summary: 'Obtener lista de espera para Almacén General' })
  async getPedidosAG() {
    return this.pedidoRepo.find({
      where: {
        statusGlobal: StatusGlobal.PENDIENTE_AG,
      },
      relations: ['surtidorCc'], // Traemos quién lo surtió antes (Juan Ramirez)
      order: { fechaCreacion: 'ASC' }
    });
  }

  @Get('en-surtido')
  @ApiOperation({ summary: 'Obtener pedidos que se están surtiendo actualmente' })
  async getPedidosEnSurtido() {
    return this.pedidoRepo.find({
      where: {
        statusGlobal: In([StatusGlobal.EN_SURTIDO_CC, StatusGlobal.EN_SURTIDO_AG]),
      },
      // Incluimos las relaciones para poder ver el nombre de quién surte
      relations: ['surtidorCc', 'surtidorAg'], 
      order: { fechaCreacion: 'ASC' }
    });
  }

  @Get(':id/detalle')
  @ApiOperation({ summary: 'Ver productos de un pedido específico' })
  async getDetalle(@Param('id') id: number) {
    return this.pedidoRepo.findOne({
      where: { id },
      relations: ['detalles', 'detalles.producto', 'detalles.producto.codigos']
    });
  }

  // -----------------------------------------------------
  // 2. OPERACIONES (PATCH / POST)
  // -----------------------------------------------------

  @Patch(':id/asignar')
  @ApiOperation({ summary: 'Asignar un pedido a un usuario (CC o AG)' })
  async asignarUsuario(
    @Param('id') id: number,
    @Body() dto: AsignarPedidoDto // Validado automáticamente
  ) {
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
    
    // TIEMPO REAL: Avisar que este pedido ya no está disponible
    this.eventsGateway.emitirCambioEstado({ idPedido: id, nuevoEstado: pedido.statusGlobal });
    
    return actualizado;
  }

  @Post('asignar-siguiente')
  @ApiOperation({ summary: 'Asigna el pedido más antiguo disponible a un usuario' })
  async asignarSiguienteDisponible(
    @Body() dto: AsignarSiguienteDto
  ) {
    // 1. Buscar el primer pedido disponible
    // Un pedido está "disponible" si está en 'ESPERA_CC' o 'PENDIENTE_AG'.
    // Usamos In([...]) para buscar cualquiera de esos estados.
    const pedido = await this.pedidoRepo.findOne({
      where: {
        statusGlobal: In([StatusGlobal.PENDIENTE_AG]),
      },
      order: {
        fechaCreacion: 'ASC' // El más antiguo primero
      }
    });

    // Si no hay pedidos en espera, lo notificamos.
    if (!pedido) {
      throw new NotFoundException('No hay pedidos disponibles en este momento.');
    }

    // 2. Asignar el pedido según su estado actual
    if (pedido.statusGlobal === StatusGlobal.PENDIENTE_AG) {
      pedido.surtidorAgId = dto.userId;
      pedido.fechaInicioAg = new Date();
      pedido.statusGlobal = StatusGlobal.EN_SURTIDO_AG;
    }

    // 3. Guardar los cambios en la base de datos
    const pedidoAsignado = await this.pedidoRepo.save(pedido);

    // 4. Notificar por WebSocket que el pedido cambió de estado
    // Así, los demás clientes (paneles) sabrán que este pedido ya no está en la lista de espera.
    this.eventsGateway.emitirCambioEstado({ 
      idPedido: pedidoAsignado.id, 
      nuevoEstado: pedidoAsignado.statusGlobal 
    });

    return pedidoAsignado;
  }

  @Patch('linea/:id')
  @ApiOperation({ summary: 'Actualizar cantidad surtida de un producto' })
  async actualizarLinea(
    @Param('id') id: number,
    @Body() dto: ActualizarLineaDto
  ) {
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

  @Post(':id/finalizar-etapa')
  @ApiOperation({ summary: 'Terminar surtido en una zona y pasar a la siguiente' })
  async finalizarEtapa(
    @Param('id') id: number,
    @Body() dto: FinalizarEtapaDto
  ) {
    const pedido = await this.pedidoRepo.findOne({ 
      where: { id }, 
      relations: ['detalles'] 
    });
    if (!pedido) throw new NotFoundException();

    if (dto.zona === 'CC') {
      pedido.fechaFinCc = new Date();
      
      // Lógica de transición
      const tieneItemsAG = pedido.detalles.some(d => d.zonaSurtido === Zona.AG);
      
      if (tieneItemsAG) {
        pedido.statusGlobal = StatusGlobal.PENDIENTE_AG; // Pasa a la siguiente cola
      } else {
        pedido.statusGlobal = StatusGlobal.COMPLETADO; // Va directo a empaque
      }
    } 
    else if (dto.zona === 'AG') {
      pedido.fechaFinAg = new Date();
      pedido.statusGlobal = StatusGlobal.COMPLETADO;
    }

    const guardado = await this.pedidoRepo.save(pedido);

    // TIEMPO REAL: Si pasó a AG, avisar al panel de Almacén General
    if (guardado.statusGlobal === StatusGlobal.PENDIENTE_AG) {
        this.eventsGateway.emitirNuevoPedido(guardado);
    } else {
        this.eventsGateway.emitirCambioEstado({ idPedido: id, nuevoEstado: guardado.statusGlobal });
    }

    return guardado;
  }
}