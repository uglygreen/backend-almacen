import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  // Simulación de envío de mensaje (Twilio / Meta API placeholder)
  async sendStatusUpdate(numero: string, nombreCliente: string, folioGarantia: string, nuevoEstado: string) {
    const mensaje = `Hola ${nombreCliente}, tu garantía ${folioGarantia} ha pasado al estado: ${nuevoEstado}`;
    
    // Aquí iría la llamada real a la API de WhatsApp
    // await this.twilioClient.messages.create({ ... })
    
    this.logger.log(`[WHATSAPP MOCK] Enviando a ${numero}: "${mensaje}"`);
    return { sent: true, message: mensaje };
  }
}
