import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClienteMobileSession } from '../../entities';

@Injectable()
export class ClientesMobileAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(ClienteMobileSession)
    private readonly sessionsRepository: Repository<ClienteMobileSession>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_CLIENTE_ACCESS_SECRET || 'clientes-mobile-access-secret',
      });

      if (!payload.sid) {
        throw new UnauthorizedException('Sesión no válida');
      }

      const session = await this.sessionsRepository.findOne({
        where: { id: payload.sid },
      });

      if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
        throw new UnauthorizedException('Sesión no válida o revocada');
      }

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token de acceso inválido o expirado');
    }
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return null;
  }
}
