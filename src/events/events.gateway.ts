import { OnModuleInit } from '@nestjs/common';
import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // Permitir conexión desde Angular y App Móvil
  },
})
export class EventsGateway implements OnModuleInit {
  @WebSocketServer()
  server: Server;

  onModuleInit() {
    console.log('Servidor de WebSockets iniciado');
  }

  // Método para emitir eventos a todos los clientes conectados
  // Usar esto desde SincronizacionService cuando llegue un pedido nuevo
  emitirNuevoPedido(data: any) {
    this.server.emit('nuevo_pedido', data);
  }

  emitirCambioEstado(data: { idPedido: number, nuevoEstado: string }) {
    this.server.emit('pedido_actualizado', data);
  }

  emitirAlertaSurtido(mensaje: string) {
    this.server.emit('alerta_almacen', { mensaje });
  }
}