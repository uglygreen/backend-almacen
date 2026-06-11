import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlmacenUser } from '../../entities';
import { AuditAlmacenService } from '../audit-almacen/audit-almacen.service';
import { LoginAuthAlmacenDto } from './dto/login-auth-almacen.dto';
import { RefreshAuthAlmacenDto } from './dto/refresh-auth-almacen.dto';

@Injectable()
export class AuthAlmacenService {
  private readonly accessSecret = process.env.JWT_ACCESS_SECRET || 'almacen-access-secret';
  private readonly refreshSecret = process.env.JWT_REFRESH_SECRET || 'almacen-refresh-secret';

  constructor(
    @InjectRepository(AlmacenUser)
    private readonly almacenUserRepository: Repository<AlmacenUser>,
    private readonly auditAlmacenService: AuditAlmacenService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginAuthAlmacenDto) {
    const user = await this.almacenUserRepository.findOne({
      where: { id: loginDto.operatorId },
    });

    if (!user) {
      await this.auditAlmacenService.recordEvent({
        eventType: 'auth.login',
        entityType: 'AlmacenUser',
        entityId: loginDto.operatorId,
        operatorId: loginDto.operatorId,
        status: 'not_found',
        sourceModule: 'auth-almacen',
        summary: `Intento de login para almacenista inexistente ${loginDto.operatorId}`,
        payload: { operatorId: loginDto.operatorId },
      });
      throw new NotFoundException(`No existe el almacenista ${loginDto.operatorId}`);
    }

    if (!user.activo) {
      await this.auditAlmacenService.recordEvent({
        eventType: 'auth.login',
        entityType: 'AlmacenUser',
        entityId: user.id,
        operatorId: user.id,
        status: 'inactive',
        sourceModule: 'auth-almacen',
        summary: `Intento de login con almacenista inactivo ${user.id}`,
        payload: { operatorId: user.id, activo: false },
      });
      throw new UnauthorizedException(`El almacenista ${loginDto.operatorId} está inactivo`);
    }

    const auditId = await this.auditAlmacenService.recordEvent({
      eventType: 'auth.login',
      entityType: 'AlmacenUser',
      entityId: user.id,
      operatorId: user.id,
      status: 'success',
      sourceModule: 'auth-almacen',
      summary: `Login exitoso para almacenista ${user.id}`,
      payload: {
        operatorId: user.id,
        nombre: user.nombre,
        seccion: user.seccion,
      },
    });

    return this.buildAuthResponse(user, auditId);
  }

  async refresh(refreshDto: RefreshAuthAlmacenDto) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshDto.refreshToken, {
        secret: this.refreshSecret,
      });

      const user = await this.almacenUserRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.activo) {
        throw new UnauthorizedException('Sesión no válida');
      }

      const auditId = await this.auditAlmacenService.recordEvent({
        eventType: 'auth.refresh',
        entityType: 'AlmacenUser',
        entityId: user.id,
        operatorId: user.id,
        status: 'success',
        sourceModule: 'auth-almacen',
        summary: `Refresh exitoso para almacenista ${user.id}`,
        payload: { operatorId: user.id },
      });

      return this.buildAuthResponse(user, auditId);
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  async me(userId: number) {
    const user = await this.almacenUserRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`No existe el almacenista ${userId}`);
    }

    return {
      user: {
        id: user.id,
        nombre: user.nombre,
        usuario: user.usuario,
        area: user.area,
        seccion: user.seccion,
      },
      permissions: this.getPermissions(),
    };
  }

  private async buildAuthResponse(user: AlmacenUser, auditId: number | null) {
    const permissions = this.getPermissions();
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        nombre: user.nombre,
        permissions,
      },
      {
        secret: this.accessSecret,
        expiresIn: '10h',
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        type: 'refresh',
      },
      {
        secret: this.refreshSecret,
        expiresIn: '7d',
      },
    );

    return {
      sessionType: 'jwt',
      accessToken,
      refreshToken,
      expiresIn: 36000,
      auditId,
      user: {
        id: user.id,
        nombre: user.nombre,
        usuario: user.usuario,
        area: user.area,
        seccion: user.seccion,
      },
      permissions,
    };
  }

  private getPermissions() {
    return ['dashboard:read', 'captura:write', 'reportes:read', 'historical:read'];
  }
}
