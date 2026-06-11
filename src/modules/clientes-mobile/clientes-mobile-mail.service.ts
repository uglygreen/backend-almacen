import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import { envBoolean } from '../../config/runtime-env';

@Injectable()
export class ClientesMobileMailService {
  private readonly logger = new Logger(ClientesMobileMailService.name);
  private transporter: nodemailer.Transporter | null = null;

  async sendOtpMail(params: {
    correo: string;
    nombreCliente: string | null | undefined;
    numeroCliente: string | null | undefined;
    otpCode: string;
    expiresInMinutes: number;
  }) {
    const transporter = this.getTransporter();
    if (!transporter) {
      return false;
    }

    const from = this.getFromAddress();
    const customerName = (params.nombreCliente ?? '').trim() || `Cliente ${params.numeroCliente ?? ''}`.trim();
    const subject = 'Tu codigo de verificacion';
    const logoAttachment = this.getLogoAttachment();
    const logoMarkup = logoAttachment
      ? '<img src="cid:ferremayoristas-logo" alt="Grupo Ferremayoristas del Bajio" width="260" style="display:block;width:260px;height:auto;margin:0 auto 24px auto;border:0;outline:none;text-decoration:none;" />'
      : '<div style="font-size:26px;font-weight:800;letter-spacing:1px;color:#111827;margin-bottom:24px;">Grupo Ferremayoristas del Bajio</div>';
    const text = [
      `Hola ${customerName},`,
      '',
      'Has solicitado un codigo de verificacion para iniciar sesion.',
      '',
      `Tu codigo de verificacion es: ${params.otpCode}`,
      `Este codigo vence en ${params.expiresInMinutes} minutos.`,
      '',
      'Si no solicitaste este acceso, puedes ignorar este mensaje.',
      '',
      'Aviso de confidencialidad: Este mensaje y sus anexos pueden contener informacion confidencial y de uso exclusivo para su destinatario. Si lo recibiste por error, elimina su contenido y notifica al remitente.',
    ].join('\n');

    const html = `
      <div style="margin:0;padding:32px 16px;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;margin:0 auto;">
          <tr>
            <td align="center">
              <div style="background-color:#ffffff;border-radius:20px;padding:40px 32px;box-shadow:0 10px 30px rgba(15,23,42,0.08);text-align:center;">
                ${logoMarkup}
                <div style="display:inline-block;padding:8px 14px;border-radius:9999px;background-color:#fee2e2;color:#b91c1c;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;">
                  Acceso seguro clientes mobile
                </div>
                <h1 style="margin:20px 0 12px 0;font-size:28px;line-height:1.2;color:#111827;">Codigo de verificacion OTP</h1>
                <p style="margin:0 0 10px 0;font-size:16px;line-height:1.6;color:#374151;">Hola ${this.escapeHtml(customerName)},</p>
                <p style="margin:0 0 26px 0;font-size:16px;line-height:1.6;color:#4b5563;">
                  Utiliza el siguiente codigo para completar tu inicio de sesion en la plataforma de clientes de Grupo Ferremayoristas del Bajio.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px auto;border-collapse:separate;">
                  <tr>
                    <td align="center" style="padding:18px 28px;background-color:#fee2e2;border:2px solid #fca5a5;border-radius:16px;">
                      <span style="display:inline-block;font-size:34px;font-weight:800;letter-spacing:10px;line-height:1;color:#991b1b;">
                        ${this.escapeHtml(params.otpCode)}
                      </span>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#374151;">
                  Este codigo vence en <strong>${params.expiresInMinutes} minutos</strong>.
                </p>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#6b7280;">
                  Si no solicitaste este acceso, puedes ignorar este mensaje con tranquilidad.
                </p>
                <div style="padding-top:24px;border-top:1px solid #e5e7eb;">
                  <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#6b7280;">
                    Este correo fue generado automaticamente. Favor de no responder a esta direccion.
                  </p>
                  <p style="margin:0;font-size:11px;line-height:1.7;color:#9ca3af;">
                    Aviso de confidencialidad profesional: La informacion contenida en este correo electronico, incluyendo sus anexos, es confidencial y esta dirigida exclusivamente a su destinatario. Si usted recibio este mensaje por error, cualquier revision, uso, divulgacion, distribucion o copia queda estrictamente prohibida. Le solicitamos eliminarlo de inmediato y notificar al remitente. Grupo Ferremayoristas del Bajio protege el uso responsable y confidencial de su informacion.
                  </p>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </div>
    `;

    await transporter.sendMail({
      from,
      to: params.correo,
      subject,
      text,
      html,
      attachments: logoAttachment ? [logoAttachment] : [],
    });

    return true;
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = ['1', 'true', 'yes'].includes((process.env.SMTP_SECURE || '').trim().toLowerCase());
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const ignoreTls = envBoolean('SMTP_IGNORE_TLS', false);
    const rejectUnauthorized = envBoolean('SMTP_TLS_REJECT_UNAUTHORIZED', true);

    if (!host || !port || !user || !pass) {
      this.logger.warn('SMTP no configurado. El OTP seguira usando fallback a logs');
      return null;
    }

    if (ignoreTls) {
      this.logger.warn('SMTP configurado con STARTTLS deshabilitado por SMTP_IGNORE_TLS');
    } else if (!rejectUnauthorized) {
      this.logger.warn('SMTP configurado con validacion TLS deshabilitada por SMTP_TLS_REJECT_UNAUTHORIZED=false');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ignoreTLS: ignoreTls,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized,
      },
    });

    return this.transporter;
  }

  private getFromAddress(): string {
    const fromName = (process.env.SMTP_FROM_NAME || 'Ferremayoristas').trim();
    const fromEmail = (process.env.SMTP_FROM || process.env.SMTP_USER || 'sistemas@ferremayoristas.com.mx').trim();
    return `"${fromName.replace(/"/g, '')}" <${fromEmail}>`;
  }

  private getLogoAttachment(): nodemailer.Attachment | null {
    const candidates = [
      path.join(process.cwd(), 'logo-extendido.png'),
      path.resolve(__dirname, '../../../logo-extendido.png'),
    ];

    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) {
        continue;
      }

      return {
        filename: 'logo-extendido.png',
        path: filePath,
        cid: 'ferremayoristas-logo',
      };
    }

    this.logger.warn('No se encontro logo-extendido.png para incrustarlo en el correo OTP');
    return null;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
