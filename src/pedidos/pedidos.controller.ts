import { Controller, Get, Post, Body, Patch, Param, Delete, NotFoundException } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { DetallePedido, Pedido, StatusGlobal, StatusLinea, Zona } from 'src/entities';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';



@Controller('pedidos')
export class PedidosController {
  constructor(
    @InjectRepository(Pedido) private pedidoRepo: Repository<Pedido>,
    @InjectRepository(DetallePedido) private detalleRepo: Repository<DetallePedido>,
  ) {}

  // 1. Obtener Pedidos para Cuarto Chico
  @Get('cuarto-chico')
  async getPedidosCC() {
    return this.pedidoRepo.find({
      where: {
        statusGlobal: StatusGlobal.ESPERA_CC,
        requiereCuartoChico: true,
      },
      order: { fechaCreacion: 'ASC' }
    });
  }

  // 2. Obtener Pedidos para Almacén General
  // Nota: Incluye los que vienen directo Y los que ya salieron de CC
  @Get('almacen-general')
  async getPedidosAG() {
    return this.pedidoRepo.find({
      where: {
        statusGlobal: StatusGlobal.PENDIENTE_AG,
      },
      relations: ['surtidorCc'], // Para mostrar "Surtido por Juan"
      order: { fechaCreacion: 'ASC' }
    });
  }

  // 3. Asignar Usuario a Pedido
  @Patch(':id/asignar')
  async asignarUsuario(
    @Param('id') id: number,
    @Body() body: { userId: number, zona: 'CC' | 'AG' }
  ) {
    const pedido = await this.pedidoRepo.findOne({ where: { id } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    if (body.zona === 'CC') {
      pedido.surtidorCcId = body.userId;
      pedido.fechaInicioCc = new Date();
      pedido.statusGlobal = StatusGlobal.EN_SURTIDO_CC;
    } else {
      pedido.surtidorAgId = body.userId;
      pedido.fechaInicioAg = new Date();
      pedido.statusGlobal = StatusGlobal.EN_SURTIDO_AG;
    }

    return this.pedidoRepo.save(pedido);
  }

  // 4. Ver Detalle de un Pedido (Filtrado por Zona si se desea)
  @Get(':id/detalle')
  async getDetalle(@Param('id') id: number) {
    return this.pedidoRepo.findOne({
      where: { id },
      relations: ['detalles', 'detalles.producto']
    });
  }

  // 5. Actualizar una línea (Surtido parcial o completo)
  @Patch('linea/:id')
  async actualizarLinea(
    @Param('id') id: number,
    @Body() body: { cantidadSurtida: number, nota?: string }
  ) {
    const linea = await this.detalleRepo.findOne({ where: { id } });
    if (!linea) throw new NotFoundException('Línea no encontrada');

    linea.cantidadSurtida = body.cantidadSurtida;
    linea.notaIncidencia = body.nota ?? '';

    // Lógica de estado de línea
    if (linea.cantidadSurtida === 0) {
      linea.statusLinea = StatusLinea.NO_ENCONTRADO;
    } else if (linea.cantidadSurtida < linea.cantidadSolicitada) {
      linea.statusLinea = StatusLinea.PARCIAL;
    } else {
      linea.statusLinea = StatusLinea.COMPLETADO;
    }

    return this.detalleRepo.save(linea);
  }

  // 6. Finalizar Etapa (Transición de Estado Global)
  @Post(':id/finalizar-etapa')
  async finalizarEtapa(
    @Param('id') id: number,
    @Body() body: { zona: 'CC' | 'AG' }
  ) {
    const pedido = await this.pedidoRepo.findOne({ 
      where: { id }, 
      relations: ['detalles'] 
    });
    if (!pedido) throw new NotFoundException();

    if (body.zona === 'CC') {
      // Validar que todo lo de CC esté procesado
      // ... (Lógica de validación opcional)
      
      pedido.fechaFinCc = new Date();
      
      // Verificar si tiene items de AG
      const tieneItemsAG = pedido.detalles.some(d => d.zonaSurtido === Zona.AG);
      
      if (tieneItemsAG) {
        pedido.statusGlobal = StatusGlobal.PENDIENTE_AG; // Pasa a la siguiente cola
      } else {
        pedido.statusGlobal = StatusGlobal.COMPLETADO; // Va directo a empaque
      }
    } 
    else if (body.zona === 'AG') {
      pedido.fechaFinAg = new Date();
      pedido.statusGlobal = StatusGlobal.COMPLETADO;
    }

    return this.pedidoRepo.save(pedido);
  }
}