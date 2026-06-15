import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash, randomBytes, randomInt } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Cliente, ClienteMobileOtp, ClienteMobileSession, CorreoLegacy, DocLegacy } from '../../entities';
import { envString } from '../../config/runtime-env';
import { ListDiscountedProductsClienteMobileDto } from './dto/list-discounted-products-cliente-mobile.dto';
import { LoginClienteMobileDto } from './dto/login-cliente-mobile.dto';
import { LogoutClienteMobileDto } from './dto/logout-cliente-mobile.dto';
import { RefreshClienteMobileDto } from './dto/refresh-cliente-mobile.dto';
import { RequestOtpClienteMobileDto } from './dto/request-otp-cliente-mobile.dto';
import { SearchCatalogByBrandClienteMobileDto } from './dto/search-catalog-by-brand-cliente-mobile.dto';
import { SearchCatalogClienteMobileDto } from './dto/search-catalog-cliente-mobile.dto';
import { VerifyOtpClienteMobileDto } from './dto/verify-otp-cliente-mobile.dto';
import { ClientesMobileMailService } from './clientes-mobile-mail.service';
import { ClientesMobileRateLimitService } from './clientes-mobile-rate-limit.service';

type EstadoClienteMobile = {
  clave: string;
  descripcion: string;
  limitado: boolean;
  mensaje: string;
};

@Injectable()
export class ClientesMobileService {
  private readonly logger = new Logger(ClientesMobileService.name);
  private readonly accessSecret = process.env.JWT_CLIENTE_ACCESS_SECRET || 'clientes-mobile-access-secret';
  private readonly refreshSecret = process.env.JWT_CLIENTE_REFRESH_SECRET || 'clientes-mobile-refresh-secret';
  private readonly otpSecret = process.env.JWT_CLIENTE_OTP_SECRET || 'clientes-mobile-otp-secret';
  private readonly staticTestClienteId = Number(envString('CLIENTES_MOBILE_TEST_CLIENTE_ID', '999999'));
  private readonly staticTestNumeroCliente = this.normalizeNumeroCliente(
    envString('CLIENTES_MOBILE_TEST_NUMERO_CLIENTE', '07810'),
  );
  private readonly staticTestCorreo = this.normalizeCorreo(
    envString('CLIENTES_MOBILE_TEST_CORREO', 'jalopez@ferremayoristas.com.mx'),
  );
  private readonly staticTestPlayReview = ['1', 'S', 'Y', 'TRUE'].includes(
    envString('CLIENTES_MOBILE_TEST_PLAY_REVIEW', 'false').trim().toUpperCase(),
  );
  private readonly staticTestNombre = envString('CLIENTES_MOBILE_TEST_NOMBRE', 'Cliente Mobile Pruebas');
  private readonly staticTestActivo = envString('CLIENTES_MOBILE_TEST_ACTIVO', 'S');
  private readonly playReviewOtp = envString('CLIENTES_MOBILE_TEST_PLAY_REVIEW_OTP', '123456').trim();
  private readonly catalogImageBaseUrl = envString(
    'CLIENTES_MOBILE_CATALOG_IMAGE_BASE_URL',
    'https://ferremayoristas.com.mx/assets/photos-img/',
  );
  private readonly accessExpiresInSeconds = 60 * 60 * 24;
  private readonly refreshExpiresInSeconds = 60 * 60 * 24 * 60;
  private readonly otpExpiresInSeconds = 60 * 5;
  private readonly otpMaxAttempts = 5;
  private readonly otpBlockMinutes = 15;
  private readonly loginRateLimitMax = Number(process.env.CLIENTES_MOBILE_LOGIN_RATE_LIMIT_MAX || 10);
  private readonly loginRateLimitWindowSeconds = Number(process.env.CLIENTES_MOBILE_LOGIN_RATE_LIMIT_WINDOW_SECONDS || 900);
  private readonly loginPerCustomerRateLimitMax = Number(process.env.CLIENTES_MOBILE_LOGIN_PER_CUSTOMER_RATE_LIMIT_MAX || 8);
  private readonly loginPerCustomerRateLimitWindowSeconds = Number(process.env.CLIENTES_MOBILE_LOGIN_PER_CUSTOMER_RATE_LIMIT_WINDOW_SECONDS || 900);
  private readonly otpRequestRateLimitMax = Number(process.env.CLIENTES_MOBILE_OTP_REQUEST_RATE_LIMIT_MAX || 5);
  private readonly otpRequestRateLimitWindowSeconds = Number(process.env.CLIENTES_MOBILE_OTP_REQUEST_RATE_LIMIT_WINDOW_SECONDS || 600);
  private readonly otpRequestPerCustomerRateLimitMax = Number(process.env.CLIENTES_MOBILE_OTP_REQUEST_PER_CUSTOMER_RATE_LIMIT_MAX || 3);
  private readonly otpRequestPerCustomerRateLimitWindowSeconds = Number(process.env.CLIENTES_MOBILE_OTP_REQUEST_PER_CUSTOMER_RATE_LIMIT_WINDOW_SECONDS || 600);
  private readonly otpVerifyRateLimitMax = Number(process.env.CLIENTES_MOBILE_OTP_VERIFY_RATE_LIMIT_MAX || 10);
  private readonly otpVerifyRateLimitWindowSeconds = Number(process.env.CLIENTES_MOBILE_OTP_VERIFY_RATE_LIMIT_WINDOW_SECONDS || 600);
  private readonly otpVerifyPerCustomerRateLimitMax = Number(process.env.CLIENTES_MOBILE_OTP_VERIFY_PER_CUSTOMER_RATE_LIMIT_MAX || 6);
  private readonly otpVerifyPerCustomerRateLimitWindowSeconds = Number(process.env.CLIENTES_MOBILE_OTP_VERIFY_PER_CUSTOMER_RATE_LIMIT_WINDOW_SECONDS || 600);

  constructor(
    @InjectRepository(Cliente, 'legacy_db')
    private readonly clientesRepository: Repository<Cliente>,
    @InjectRepository(CorreoLegacy, 'legacy_db')
    private readonly correosRepository: Repository<CorreoLegacy>,
    @InjectRepository(DocLegacy, 'legacy_db')
    private readonly docRepository: Repository<DocLegacy>,
    @InjectDataSource('legacy_db')
    private readonly legacyDataSource: DataSource,
    @InjectRepository(ClienteMobileOtp)
    private readonly otpRepository: Repository<ClienteMobileOtp>,
    @InjectRepository(ClienteMobileSession)
    private readonly sessionsRepository: Repository<ClienteMobileSession>,
    private readonly jwtService: JwtService,
    private readonly clientesMobileMailService: ClientesMobileMailService,
    private readonly clientesMobileRateLimitService: ClientesMobileRateLimitService,
  ) {}

  async login(loginDto: LoginClienteMobileDto, request?: any) {
    const requestMeta = this.extractRequestMeta(request);
    const numeroCliente = this.normalizeNumeroCliente(loginDto.numeroCliente);

    this.clientesMobileRateLimitService.consume({
      scope: 'clientes-mobile-login',
      key: requestMeta.ip,
      limit: this.loginRateLimitMax,
      windowSeconds: this.loginRateLimitWindowSeconds,
      message: 'Demasiados intentos de inicio de sesión. Intenta nuevamente más tarde.',
    });

    this.clientesMobileRateLimitService.consume({
      scope: 'clientes-mobile-login-customer',
      key: numeroCliente,
      limit: this.loginPerCustomerRateLimitMax,
      windowSeconds: this.loginPerCustomerRateLimitWindowSeconds,
      message: 'Demasiados intentos para este cliente. Intenta nuevamente más tarde.',
    });

    const correo = this.normalizeCorreo(loginDto.correo);
    const cliente = await this.findClienteByLogin(numeroCliente, correo);

    if (!this.isClienteActivo(cliente.activo)) {
      throw new UnauthorizedException('El cliente se encuentra inactivo');
    }

    return this.issueSessionTokens(cliente, correo, request);
  }

  async requestOtp(requestOtpDto: RequestOtpClienteMobileDto, request?: any) {
    const requestMeta = this.extractRequestMeta(request);
    const numeroCliente = this.normalizeNumeroCliente(requestOtpDto.numeroCliente);

    this.clientesMobileRateLimitService.consume({
      scope: 'clientes-mobile-request-otp',
      key: requestMeta.ip,
      limit: this.otpRequestRateLimitMax,
      windowSeconds: this.otpRequestRateLimitWindowSeconds,
      message: 'Demasiadas solicitudes de código. Intenta nuevamente más tarde.',
    });

    this.clientesMobileRateLimitService.consume({
      scope: 'clientes-mobile-request-otp-customer',
      key: numeroCliente,
      limit: this.otpRequestPerCustomerRateLimitMax,
      windowSeconds: this.otpRequestPerCustomerRateLimitWindowSeconds,
      message: 'Demasiadas solicitudes de código para este cliente. Intenta nuevamente más tarde.',
    });

    const correo = this.normalizeCorreo(requestOtpDto.correo);
    const cliente = await this.findClienteByLogin(numeroCliente, correo);

    if (!this.isClienteActivo(cliente.activo)) {
      throw new UnauthorizedException('No fue posible enviar el código de verificación');
    }

    if (this.isPlayReviewAccount(numeroCliente, correo)) {
      await this.invalidatePreviousOtps(cliente.clienteId, correo);
      this.logger.log(`Cuenta play_review detectada para cliente ${numeroCliente}. Se omite envio de OTP.`);
      return {
        success: true,
        challenge: 'otp_sent',
        expiresIn: this.otpExpiresInSeconds,
        message: 'Cuenta de revision detectada. Usa el codigo de acceso configurado para Play Review.',
      };
    }

    await this.invalidatePreviousOtps(cliente.clienteId, correo);

    const otpCode = this.generateOtpCode();
    const otpSalt = this.generateSalt();
    const otpHash = this.hashOtp(otpSalt, otpCode);
    const expiresAt = new Date(Date.now() + this.otpExpiresInSeconds * 1000);

    const otpEntity = this.otpRepository.create({
      clienteId: cliente.clienteId,
      numeroCliente,
      correo,
      otpHash,
      otpSalt,
      expiresAt,
      attempts: 0,
      maxAttempts: this.otpMaxAttempts,
      blockedUntil: null,
      usedAt: null,
    });

    await this.otpRepository.save(otpEntity);
    await this.dispatchOtpCode(cliente, correo, otpCode, expiresAt);

    return {
      success: true,
      challenge: 'otp_sent',
      expiresIn: this.otpExpiresInSeconds,
      message: `Se envió un código de verificación al correo ${this.maskCorreo(correo)}`,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpClienteMobileDto, request?: any) {
    const requestMeta = this.extractRequestMeta(request);
    const numeroCliente = this.normalizeNumeroCliente(verifyOtpDto.numeroCliente);

    this.clientesMobileRateLimitService.consume({
      scope: 'clientes-mobile-verify-otp',
      key: requestMeta.ip,
      limit: this.otpVerifyRateLimitMax,
      windowSeconds: this.otpVerifyRateLimitWindowSeconds,
      message: 'Demasiados intentos de verificación. Intenta nuevamente más tarde.',
    });

    this.clientesMobileRateLimitService.consume({
      scope: 'clientes-mobile-verify-otp-customer',
      key: numeroCliente,
      limit: this.otpVerifyPerCustomerRateLimitMax,
      windowSeconds: this.otpVerifyPerCustomerRateLimitWindowSeconds,
      message: 'Demasiados intentos de verificación para este cliente. Intenta nuevamente más tarde.',
    });

    const correo = this.normalizeCorreo(verifyOtpDto.correo);
    const otp = (verifyOtpDto.otp ?? '').trim();

    if (this.isPlayReviewAccount(numeroCliente, correo)) {
      if (otp !== this.playReviewOtp) {
        throw new UnauthorizedException('El código de verificación es inválido o expiró');
      }

      const cliente = await this.findClienteByLogin(numeroCliente, correo);
      if (!this.isClienteActivo(cliente.activo)) {
        throw new UnauthorizedException('El cliente se encuentra inactivo');
      }

      this.logger.log(`Acceso play_review aplicado para cliente ${numeroCliente}.`);
      return this.issueSessionTokens(cliente, correo, request, undefined, {
        deviceName: verifyOtpDto.deviceName,
        deviceId: verifyOtpDto.deviceId,
      });
    }

    const otpRecord = await this.findLatestOtp(numeroCliente, correo);

    if (!otpRecord) {
      throw new UnauthorizedException('El código de verificación es inválido o expiró');
    }

    if (otpRecord.blockedUntil && otpRecord.blockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('El código se encuentra bloqueado temporalmente. Solicita uno nuevo');
    }

    if (otpRecord.usedAt || otpRecord.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('El código de verificación es inválido o expiró');
    }

    const otpHash = this.hashOtp(otpRecord.otpSalt, otp);
    if (otpHash !== otpRecord.otpHash) {
      otpRecord.attempts += 1;
      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        otpRecord.blockedUntil = new Date(Date.now() + this.otpBlockMinutes * 60 * 1000);
      }
      await this.otpRepository.save(otpRecord);
      throw new UnauthorizedException('El código de verificación es inválido o expiró');
    }

    otpRecord.usedAt = new Date();
    otpRecord.blockedUntil = null;
    await this.otpRepository.save(otpRecord);

    const cliente = await this.findClienteById(otpRecord.clienteId);
    if (!this.isClienteActivo(cliente.activo)) {
      throw new UnauthorizedException('El cliente se encuentra inactivo');
    }

    return this.issueSessionTokens(cliente, correo, request, undefined, {
      deviceName: verifyOtpDto.deviceName,
      deviceId: verifyOtpDto.deviceId,
    });
  }

  async refresh(refreshDto: RefreshClienteMobileDto, request?: any) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshDto.refreshToken, {
        secret: this.refreshSecret,
      });

      if (payload.type !== 'refresh' || !payload.sid) {
        throw new UnauthorizedException('Sesión no válida');
      }

      const session = await this.sessionsRepository.findOne({
        where: { id: payload.sid },
      });

      if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
        throw new UnauthorizedException('Sesión no válida');
      }

      const refreshTokenHash = this.hashRefreshToken(refreshDto.refreshToken);
      if (session.refreshTokenHash !== refreshTokenHash) {
        throw new UnauthorizedException('Sesión no válida');
      }

      const cliente = await this.findClienteById(payload.sub);
      const correo = this.normalizeCorreo(payload.correo);

      const correoValido = await this.existsCorreo(cliente.clienteId, correo);
      if (!correoValido || !this.isClienteActivo(cliente.activo)) {
        throw new UnauthorizedException('Sesión no válida');
      }

      return this.issueSessionTokens(cliente, correo, request, session);
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  async logout(logoutDto: LogoutClienteMobileDto) {
    try {
      const payload = await this.jwtService.verifyAsync(logoutDto.refreshToken, {
        secret: this.refreshSecret,
      });

      if (!payload.sid) {
        return { loggedOut: true };
      }

      const session = await this.sessionsRepository.findOne({
        where: { id: payload.sid },
      });

      if (!session) {
        return { loggedOut: true };
      }

      const refreshTokenHash = this.hashRefreshToken(logoutDto.refreshToken);
      if (session.refreshTokenHash === refreshTokenHash) {
        session.revokedAt = new Date();
        await this.sessionsRepository.save(session);
      }

      return { loggedOut: true };
    } catch {
      return { loggedOut: true };
    }
  }

  async validate(clienteId: number) {
    const cliente = await this.findClienteById(clienteId);

    return {
      valid: true,
      customer: this.mapClienteSession(cliente),
    };
  }

  async me(clienteId: number) {
    const cliente = await this.findClienteById(clienteId);
    return {
      customer: this.mapClienteSession(cliente),
    };
  }

  async getEstadoCuenta(clienteId: number) {
    const cliente = await this.findClienteById(clienteId, ['correos']);
    const hoy = this.startOfToday();

    const facturasAbiertas = await this.docRepository
      .createQueryBuilder('doc')
      .where('doc.clienteId = :clienteId', { clienteId })
      .andWhere('doc.tipo = :tipo', { tipo: 'F' })
      .andWhere('doc.estado = :estado', { estado: 'I' })
      .andWhere('(COALESCE(doc.total, 0) - COALESCE(doc.totalPagado, 0)) > 0')
      .orderBy('doc.vence', 'ASC')
      .addOrderBy('doc.numero', 'ASC')
      .getMany();

    const facturas = facturasAbiertas.map((factura) => {
      const saldoPendiente = this.toMoney(this.toNumber(factura.total) - this.toNumber(factura.totalPagado));
      const fechaVencimiento = this.toDateOnly(factura.vence);
      const diasAtraso = fechaVencimiento ? Math.max(this.diffInDays(hoy, fechaVencimiento), 0) : 0;
      const atrasada = fechaVencimiento ? fechaVencimiento.getTime() < hoy.getTime() : false;

      return {
        // folio: this.buildFolio(factura.serie, factura.numero),
        folio: factura.numero,
        fechaVencimiento: fechaVencimiento ? this.formatDate(fechaVencimiento) : null,
        montoPendiente: saldoPendiente,
        diasAtraso: atrasada ? diasAtraso : 0,
        atrasada,
      };
    });

    const facturasPendientes = facturas.filter((factura) => !factura.atrasada);
    const facturasAtrasadas = facturas.filter((factura) => factura.atrasada);
    const totalPendiente = this.toMoney(
      facturasPendientes.reduce((acc, factura) => acc + factura.montoPendiente, 0),
    );
    const totalAtrasado = this.toMoney(
      facturasAtrasadas.reduce((acc, factura) => acc + factura.montoPendiente, 0),
    );
    const totalAdeudo = this.toMoney(totalPendiente + totalAtrasado);
    const diasMaximoAtraso = facturasAtrasadas.reduce((max, factura) => Math.max(max, factura.diasAtraso), 0);

    const estatusCredito = this.resolveEstadoCuentaCliente({
      activo: this.isClienteActivo(cliente.activo),
      facturasPendientes: facturasPendientes.length,
      facturasAtrasadas: facturasAtrasadas.length,
      diasMaximoAtraso,
    });

    return {
      cliente: {
        id: cliente.clienteId,
        numero: cliente.numero,
        nombre: cliente.nombre,
        activo: this.isClienteActivo(cliente.activo),
        correo: this.getPrimaryCorreo(cliente.correos),
        lineaCredito: this.toMoney(cliente.limite),
        saldoActual: this.toMoney(cliente.saldo),
        creditoDisponible: this.toMoney(this.toNumber(cliente.limite) - this.toNumber(cliente.saldo)),
      },
      estadoCuenta: {
        totalAdeudo,
        totalPendiente,
        totalAtrasado,
        facturasPendientes: facturasPendientes.map(({ atrasada, ...factura }) => factura),
        facturasAtrasadas: facturasAtrasadas.map(({ atrasada, ...factura }) => factura),
      },
      estatusCredito,
    };
  }

  async searchCatalog(clienteId: number, query: SearchCatalogClienteMobileDto) {
    await this.findClienteById(clienteId);
    const searchTerm = (query.q ?? '').trim();
    const normalizedSearchTerm = searchTerm.toLowerCase();

    if (searchTerm.length < 2) {
      return [];
    }

    const limit = query.limit ?? 20;
    const likeTerm = `%${normalizedSearchTerm}%`;
    const startsWithTerm = `${normalizedSearchTerm} %`;
    const wordBoundaryTerm = `% ${normalizedSearchTerm} %`;

    try {
      // #region debug-point A:catalog-search-query
      const rows = await this.legacyDataSource.query(
        `
        SELECT
          inv.ARTICULOID AS id,
          TRIM(inv.CLVPROV) AS codigo,
          TRIM(inv.CLAVE) AS clave,
          TRIM(inv.DESCRIPCIO) AS descripcion,
          TRIM(inv.XXMARCA) AS marca,
          TRIM(inv.XMCA_IMAG) AS imagenMarca,
          TRIM(inv.XIMAGEN2) AS imagen,
          CASE
            WHEN inv.CLAVEPRODSERV IS NULL THEN NULL
            ELSE LPAD(TRIM(CAST(inv.CLAVEPRODSERV AS CHAR)), 8, '0')
          END AS claveProdServ,
          'H87' AS claveUnidad,
          TRIM(uni.UNIDAD) AS unidad,
          alm.ALMACEN AS almacen,
          IFNULL(inv.LOTE, 0) AS lote,
          IFNULL(inv.INVDESCUENTO, 0) AS descuento,
          IFNULL(pre.PIMPUESTO, 0) AS iva,
          IFNULL(ROUND((pre.PRECIO + (pre.PRECIO * (pre.PIMPUESTO / 100))), 2), 0) AS precioRegular,
          IFNULL(
            ROUND(
              (pre.PRECIO + (pre.PRECIO * (pre.PIMPUESTO / 100))) * (1 - (IFNULL(inv.INVDESCUENTO, 0) / 100)),
              2
            ),
            0
          ) AS precioDescuento
        FROM datosb.INV inv
        LEFT JOIN datosb.preciofinal pre
          ON inv.ARTICULOID = pre.ARTICULOID
          AND inv.UNIVENID = pre.UNIDADID
        LEFT JOIN datosb.UNIDADES uni
          ON inv.ARTICULOID = uni.ARTICULOID
          AND inv.UNIBASID = uni.UNIDADID
        LEFT JOIN datosb.ALM alm
          ON inv.ARTICULOID = alm.ARTICULOID
          AND alm.ALMACEN = 1
        WHERE (
          LOWER(TRIM(COALESCE(inv.CLAVE, ''))) LIKE ?
          OR LOWER(TRIM(COALESCE(inv.DESCRIPCIO, ''))) LIKE ?
          OR LOWER(TRIM(COALESCE(inv.CLVPROV, ''))) LIKE ?
        )
          AND pre.NPRECIO = 1
          AND TRIM(COALESCE(inv.CLVPROV, '')) <> ''
          AND inv.CATALOGO IN ('0', '1', '2')
        ORDER BY
          CASE
            WHEN LOWER(TRIM(COALESCE(inv.DESCRIPCIO, ''))) LIKE ? THEN 1
            WHEN LOWER(TRIM(COALESCE(inv.DESCRIPCIO, ''))) LIKE ? THEN 2
            WHEN LOWER(TRIM(COALESCE(inv.DESCRIPCIO, ''))) LIKE ? THEN 3
            ELSE 6
          END ASC,
          inv.DESCRIPCIO ASC
        LIMIT ?
      `,
      [
        likeTerm,
        likeTerm,
        likeTerm,
        startsWithTerm,
        wordBoundaryTerm,
        likeTerm,
        limit,
        ],
      );
      // #endregion

      return this.mapCatalogRows(rows);
    } catch (error) {
      // #region debug-point B:catalog-search-error
      this.logger.error(
        `[DEBUG] catalog/search failed ${JSON.stringify({
          clienteId,
          searchTerm,
          limit,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          code: (error as any)?.code,
          errno: (error as any)?.errno,
          sqlMessage: (error as any)?.sqlMessage,
          sqlState: (error as any)?.sqlState,
        })}`,
      );
      // #endregion
      throw error;
    }
  }

  async searchCatalogByBrand(clienteId: number, query: SearchCatalogByBrandClienteMobileDto) {
    await this.findClienteById(clienteId);
    const brandTerm = (query.marca ?? '').trim();
    const normalizedBrandTerm = brandTerm.toLowerCase();

    if (brandTerm.length < 2) {
      return [];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const offset = (page - 1) * limit;
    const likeTerm = `%${normalizedBrandTerm}%`;
    const startsWithTerm = `${normalizedBrandTerm}%`;

    const totalResult = await this.legacyDataSource.query(
      `
        SELECT COUNT(*) AS total
        FROM datosb.INV inv
        LEFT JOIN datosb.preciofinal pre
          ON inv.ARTICULOID = pre.ARTICULOID
          AND inv.UNIVENID = pre.UNIDADID
        WHERE LOWER(TRIM(COALESCE(inv.XXMARCA, ''))) LIKE ?
          AND pre.NPRECIO = 1
          AND TRIM(COALESCE(inv.CLVPROV, '')) <> ''
          AND inv.CATALOGO IN ('0', '1', '2')
      `,
      [likeTerm],
    );

    const total = this.toNumber(totalResult?.[0]?.total);

    const rows = await this.legacyDataSource.query(
      `
        SELECT
          inv.ARTICULOID AS id,
          TRIM(inv.CLVPROV) AS codigo,
          TRIM(inv.CLAVE) AS clave,
          TRIM(inv.DESCRIPCIO) AS descripcion,
          TRIM(inv.XXMARCA) AS marca,
          TRIM(inv.XMCA_IMAG) AS imagenMarca,
          TRIM(inv.XIMAGEN2) AS imagen,
          IFNULL(inv.LOTE, 0) AS lote,
          IFNULL(inv.INVDESCUENTO, 0) AS descuento,
          IFNULL(pre.PIMPUESTO, 0) AS iva,
          IFNULL(ROUND((pre.PRECIO + (pre.PRECIO * (pre.PIMPUESTO / 100))), 2), 0) AS precioRegular,
          IFNULL(
            ROUND(
              (pre.PRECIO + (pre.PRECIO * (pre.PIMPUESTO / 100))) * (1 - (IFNULL(inv.INVDESCUENTO, 0) / 100)),
              2
            ),
            0
          ) AS precioDescuento
        FROM datosb.INV inv
        LEFT JOIN datosb.preciofinal pre
          ON inv.ARTICULOID = pre.ARTICULOID
          AND inv.UNIVENID = pre.UNIDADID
        WHERE LOWER(TRIM(COALESCE(inv.XXMARCA, ''))) LIKE ?
          AND pre.NPRECIO = 1
          AND TRIM(COALESCE(inv.CLVPROV, '')) <> ''
          AND inv.CATALOGO IN ('0', '1', '2')
        ORDER BY
          CASE
            WHEN LOWER(TRIM(COALESCE(inv.XXMARCA, ''))) = ? THEN 1
            WHEN LOWER(TRIM(COALESCE(inv.XXMARCA, ''))) LIKE ? THEN 2
            ELSE 3
          END ASC,
          inv.DESCRIPCIO ASC
        LIMIT ? OFFSET ?
      `,
      [
        likeTerm,
        normalizedBrandTerm,
        startsWithTerm,
        limit,
        offset,
      ],
    );

    const items = this.mapCatalogRows(rows);
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page * limit < total,
      },
    };
  }

  async getDiscountedProducts(clienteId: number, query: ListDiscountedProductsClienteMobileDto) {
    await this.findClienteById(clienteId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const offset = (page - 1) * limit;

    const totalResult = await this.legacyDataSource.query(
      `
        SELECT COUNT(*) AS total
        FROM datosb.INV inv
        LEFT JOIN datosb.preciofinal pre
          ON inv.ARTICULOID = pre.ARTICULOID
          AND inv.UNIVENID = pre.UNIDADID
        LEFT JOIN datosb.UNIDADES uni
          ON inv.ARTICULOID = uni.ARTICULOID
          AND inv.UNIBASID = uni.UNIDADID
        LEFT JOIN datosb.ALM alm
          ON inv.ARTICULOID = alm.ARTICULOID
          and alm.ALMACEN = 1
        WHERE IFNULL(inv.INVDESCUENTO, 0) > 0
          AND pre.NPRECIO = 1
          AND TRIM(COALESCE(inv.CLVPROV, '')) <> ''
          AND inv.CATALOGO IN ('0', '1', '2')
      `,
    );

    const total = this.toNumber(totalResult?.[0]?.total);

    const rows = await this.legacyDataSource.query(
      `
        SELECT
          inv.ARTICULOID AS id,
          TRIM(inv.CLVPROV) AS codigo,
          TRIM(inv.CLAVE) AS clave,
          TRIM(inv.DESCRIPCIO) AS descripcion,
          TRIM(inv.XXMARCA) AS marca,
          TRIM(inv.XMCA_IMAG) AS imagenMarca,
          TRIM(inv.XIMAGEN2) AS imagen,
          IFNULL(inv.LOTE, 0) AS lote,
          IFNULL(inv.INVDESCUENTO, 0) AS descuento,
          IFNULL(pre.PIMPUESTO, 0) AS iva,
          IFNULL(ROUND((pre.PRECIO + (pre.PRECIO * (pre.PIMPUESTO / 100))), 2), 0) AS precioRegular,
          IFNULL(
            ROUND(
              (pre.PRECIO + (pre.PRECIO * (pre.PIMPUESTO / 100))) * (1 - (IFNULL(inv.INVDESCUENTO, 0) / 100)),
              2
            ),
            0
          ) AS precioDescuento
        FROM datosb.INV inv
        LEFT JOIN datosb.preciofinal pre
          ON inv.ARTICULOID = pre.ARTICULOID
          AND inv.UNIVENID = pre.UNIDADID
        WHERE IFNULL(inv.INVDESCUENTO, 0) > 0
          AND pre.NPRECIO = 1
          AND TRIM(COALESCE(inv.CLVPROV, '')) <> ''
          AND inv.CATALOGO IN ('0', '1', '2')
        ORDER BY
          inv.INVDESCUENTO DESC,
          COALESCE(inv.XPRIORIDAD, 0) DESC,
          inv.DESCRIPCIO ASC
        LIMIT ? OFFSET ?
      `,
      [limit, offset],
    );

    const items = this.mapCatalogRows(rows);
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page * limit < total,
      },
    };
  }

  async getCatalogProductDetail(clienteId: number, articuloId: number) {
    await this.findClienteById(clienteId);

    const rows = await this.legacyDataSource.query(
      `
        SELECT
          inv.ARTICULOID AS id,
          TRIM(inv.CLVPROV) AS codigo,
          TRIM(inv.CLAVE) AS clave,
          TRIM(inv.DESCRIPCIO) AS descripcion,
          TRIM(inv.XXMARCA) AS marca,
          TRIM(inv.XMCA_IMAG) AS imagenMarca,
          TRIM(inv.XIMAGEN2) AS imagen,
          CASE
            WHEN inv.CLAVEPRODSERV IS NULL THEN NULL
            ELSE LPAD(TRIM(CAST(inv.CLAVEPRODSERV AS CHAR)), 8, '0')
          END AS claveProdServ,
          'H87' AS claveUnidad,
          TRIM(uni.UNIDAD) AS unidad,
          alm.ALMACEN AS almacen,
          IFNULL(inv.LOTE, 0) AS lote,
          IFNULL(inv.INVDESCUENTO, 0) AS descuento,
          IFNULL(pre.PIMPUESTO, 0) AS iva,
          IFNULL(ROUND((pre.PRECIO + (pre.PRECIO * (pre.PIMPUESTO / 100))), 2), 0) AS precioRegular,
          IFNULL(
            ROUND(
              (pre.PRECIO + (pre.PRECIO * (pre.PIMPUESTO / 100))) * (1 - (IFNULL(inv.INVDESCUENTO, 0) / 100)),
              2
            ),
            0
          ) AS precioDescuento
        FROM datosb.INV inv
        LEFT JOIN datosb.preciofinal pre
          ON inv.ARTICULOID = pre.ARTICULOID
          AND inv.UNIVENID = pre.UNIDADID
        LEFT JOIN datosb.UNIDADES uni
          ON inv.ARTICULOID = uni.ARTICULOID
          AND inv.UNIBASID = uni.UNIDADID
        LEFT JOIN datosb.ALM alm
          ON inv.ARTICULOID = alm.ARTICULOID
          and alm.ALMACEN = 1
        WHERE inv.ARTICULOID = ?
          AND pre.NPRECIO = 1
          AND TRIM(COALESCE(inv.CLVPROV, '')) <> ''
          AND inv.CATALOGO IN ('0', '1', '2')
        LIMIT 1
      `,
      [articuloId],
    );

    const item = this.mapCatalogRows(rows)[0];
    if (!item) {
      throw new NotFoundException(`No se encontró el producto ${articuloId}`);
    }

    const existenciasRows = await this.legacyDataSource.query(
      `
        SELECT
          alm.ALMACEN AS almacen,
          TRIM(nom.NOMALMACEN) AS nombreAlmacen,
          IFNULL(alm.EXISTENCIA, 0) AS existencia
        FROM datosb.ALM alm
        INNER JOIN datosb.NOMALM nom
          ON alm.ALMACEN = nom.ALMACEN
        WHERE alm.ARTICULOID = ?
        ORDER BY alm.ALMACEN ASC
      `,
      [articuloId],
    );

    const unidadesRows = await this.legacyDataSource.query(
      `
        SELECT
          uni.UNIDADID AS unidadId,
          TRIM(uni.UNIDAD) AS unidad,
          IFNULL(uni.UEQUIVALE, 0) AS equivale
        FROM datosb.UNIDADES uni
        WHERE uni.ARTICULOID = ?
          AND uni.NUNIDAD == 0
        ORDER BY uni.UEQUIVALE ASC, uni.UNIDADID ASC
      `,
      [articuloId],
    );

    return {
      ...item,
      existencias: this.mapExistenciasRows(existenciasRows),
      unidades: this.mapUnidadesRows(unidadesRows),
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredAuthArtifacts() {
    const now = new Date();

    await this.otpRepository
      .createQueryBuilder()
      .delete()
      .from(ClienteMobileOtp)
      .where('used_at IS NOT NULL')
      .orWhere('expires_at < :now', { now })
      .execute();

    await this.sessionsRepository
      .createQueryBuilder()
      .delete()
      .from(ClienteMobileSession)
      .where('expires_at < :now', { now })
      .orWhere('revoked_at IS NOT NULL')
      .execute();

    this.logger.log('Limpieza de OTPs y sesiones móviles completada');
  }

  private async issueSessionTokens(
    cliente: Cliente,
    correo: string,
    request?: any,
    existingSession?: ClienteMobileSession,
    device?: { deviceName?: string; deviceId?: string },
  ) {
    const sessionCustomer = this.mapClienteSession(cliente, correo);
    const now = new Date();
    const sessionExpiresAt = new Date(now.getTime() + this.refreshExpiresInSeconds * 1000);
    const requestMeta = this.extractRequestMeta(request);

    const session = existingSession
      ? existingSession
      : this.sessionsRepository.create({
          clienteId: cliente.clienteId,
          numeroCliente: cliente.numero,
          correo,
          refreshTokenHash: '',
          deviceName: device?.deviceName?.trim() || null,
          deviceId: device?.deviceId?.trim() || null,
          lastIp: requestMeta.ip,
          lastUserAgent: requestMeta.userAgent,
          lastUsedAt: now,
          expiresAt: sessionExpiresAt,
          revokedAt: null,
        });

    session.clienteId = cliente.clienteId;
    session.numeroCliente = cliente.numero;
    session.correo = correo;
    session.deviceName = device?.deviceName?.trim() || session.deviceName || null;
    session.deviceId = device?.deviceId?.trim() || session.deviceId || null;
    session.lastIp = requestMeta.ip;
    session.lastUserAgent = requestMeta.userAgent;
    session.lastUsedAt = now;
    session.expiresAt = sessionExpiresAt;
    session.revokedAt = null;

    const persistedSession = await this.sessionsRepository.save(session);

    const accessToken = await this.jwtService.signAsync(
      {
        sub: cliente.clienteId,
        sid: persistedSession.id,
        numeroCliente: cliente.numero,
        correo,
        scope: 'clientes-mobile',
      },
      {
        secret: this.accessSecret,
        expiresIn: `${this.accessExpiresInSeconds}s`,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: cliente.clienteId,
        sid: persistedSession.id,
        numeroCliente: cliente.numero,
        correo,
        type: 'refresh',
        scope: 'clientes-mobile',
      },
      {
        secret: this.refreshSecret,
        expiresIn: `${this.refreshExpiresInSeconds}s`,
      },
    );

    persistedSession.refreshTokenHash = this.hashRefreshToken(refreshToken);
    persistedSession.lastUsedAt = now;
    persistedSession.expiresAt = sessionExpiresAt;
    await this.sessionsRepository.save(persistedSession);

    return {
      sessionType: 'jwt',
      accessToken,
      refreshToken,
      expiresIn: this.accessExpiresInSeconds,
      refreshExpiresIn: this.refreshExpiresInSeconds,
      customer: sessionCustomer,
    };
  }

  private async invalidatePreviousOtps(clienteId: number, correo: string) {
    await this.otpRepository
      .createQueryBuilder()
      .update(ClienteMobileOtp)
      .set({ usedAt: new Date() })
      .where('cliente_id = :clienteId', { clienteId })
      .andWhere('correo = :correo', { correo })
      .andWhere('used_at IS NULL')
      .execute();
  }

  private async findClienteByLogin(numeroCliente: string, correo: string) {
    const staticCliente = this.resolveStaticTestClienteByLogin(numeroCliente, correo);
    if (staticCliente) {
      return staticCliente;
    }

    const cliente = await this.clientesRepository
      .createQueryBuilder('cliente')
      .innerJoinAndSelect('cliente.correos', 'correo')
      .where('cliente.numero = :numeroCliente', { numeroCliente })
      .andWhere('LOWER(TRIM(correo.correo)) = :correo', { correo })
      .getOne();

    if (!cliente) {
      throw new UnauthorizedException('Número de cliente o correo incorrectos');
    }

    return cliente;
  }

  private async findLatestOtp(numeroCliente: string, correo: string) {
    return this.otpRepository.findOne({
      where: {
        numeroCliente,
        correo,
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
    });
  }

  private async findClienteById(clienteId: number, relations: string[] = []) {
    const staticCliente = this.resolveStaticTestClienteById(clienteId, relations);
    if (staticCliente) {
      return staticCliente;
    }

    const cliente = await this.clientesRepository.findOne({
      where: { clienteId },
      relations,
    });

    if (!cliente) {
      throw new NotFoundException(`No se encontró el cliente ${clienteId}`);
    }

    return cliente;
  }

  private async existsCorreo(clienteId: number, correo: string) {
    const staticCliente = this.resolveStaticTestClienteById(clienteId, ['correos']);
    if (staticCliente) {
      return this.normalizeCorreo(correo) === this.staticTestCorreo;
    }

    const existing = await this.correosRepository
      .createQueryBuilder('correo')
      .where('correo.clienteId = :clienteId', { clienteId })
      .andWhere('LOWER(TRIM(correo.correo)) = :correo', { correo })
      .getOne();

    return Boolean(existing);
  }

  private async dispatchOtpCode(cliente: Cliente, correo: string, otpCode: string, expiresAt: Date) {
    const sent = await this.clientesMobileMailService.sendOtpMail({
      correo,
      nombreCliente: cliente.nombre,
      numeroCliente: cliente.numero,
      otpCode,
      expiresInMinutes: Math.max(Math.round((expiresAt.getTime() - Date.now()) / 60000), 1),
    });

    if (!sent) {
      this.logger.warn(
        `OTP generado para cliente ${cliente.numero} (${correo}). Codigo: ${otpCode}. Expira: ${expiresAt.toISOString()}`,
      );
    }
  }

  private resolveEstadoCuentaCliente(input: {
    activo: boolean;
    facturasPendientes: number;
    facturasAtrasadas: number;
    diasMaximoAtraso: number;
  }): EstadoClienteMobile {
    const { activo, facturasPendientes, facturasAtrasadas, diasMaximoAtraso } = input;

    if (!activo) {
      return {
        clave: 'INACTIVO',
        descripcion: 'Cuenta inactiva',
        limitado: true,
        mensaje: 'Tu cuenta se encuentra inactiva. Comunícate con atención a clientes para más información.',
      };
    }

    if (facturasAtrasadas > 0 && diasMaximoAtraso >= 8) {
      return {
        clave: 'LIMITADO',
        descripcion: 'Con facturas atrasadas',
        limitado: true,
        mensaje: 'Tienes facturas con atraso considerable. Tu cuenta puede tener restricciones temporales.',
      };
    }

    if (facturasAtrasadas > 0) {
      return {
        clave: 'CON_FACTURAS_ATRASADAS',
        descripcion: 'Con facturas atrasadas',
        limitado: false,
        mensaje: 'Tienes facturas vencidas pendientes de pago. Te recomendamos regularizar tu cuenta.',
      };
    }

    if (facturasPendientes > 0) {
      return {
        clave: 'CON_FACTURAS_PENDIENTES',
        descripcion: 'Con facturas pendientes',
        limitado: false,
        mensaje: 'Tienes facturas activas aún no vencidas.',
      };
    }

    return {
      clave: 'AL_DIA',
      descripcion: 'Al día',
      limitado: false,
      mensaje: 'No tienes facturas pendientes ni atrasadas.',
    };
  }

  private mapClienteSession(cliente: Cliente, correo?: string) {
    return {
      id: cliente.clienteId,
      numeroCliente: cliente.numero,
      nombre: cliente.nombre,
      activo: this.isClienteActivo(cliente.activo),
      correo: correo ?? null,
      diaVis: this.cleanNullableString(cliente.diaVis),
    };
  }

  private getPrimaryCorreo(correos?: CorreoLegacy[]) {
    const correo = correos?.find((item) => item.correo?.trim())?.correo ?? null;
    return correo ? correo.trim() : null;
  }

  private buildCatalogImageUrl(imageName: string | null | undefined): string | null {
    const cleanImageName = this.cleanNullableString(imageName);
    if (!cleanImageName) {
      return null;
    }

    const baseUrl = this.catalogImageBaseUrl.endsWith('/')
      ? this.catalogImageBaseUrl
      : `${this.catalogImageBaseUrl}/`;

    const fileName = cleanImageName.replace(/\.[^.]+$/i, '.webp');
    return `${baseUrl}${encodeURIComponent(fileName)}`;
  }

  private mapCatalogRows(rows: any[]) {
    return rows.map((item) => {
      const precio = this.toMoney(item.precioRegular);
      const descuento = this.toNumber(item.descuento);
      const precioConDescuento = this.toMoney(item.precioDescuento);

      return {
        id: this.toNumber(item.id),
        codigo: this.cleanNullableString(item.codigo),
        clave: this.cleanNullableString(item.clave),
        descripcion: this.cleanNullableString(item.descripcion),
        marca: this.cleanNullableString(item.marca),
        imagen: this.buildCatalogImageUrl(item.imagen),
        imagenMarca: this.buildCatalogImageUrl(item.imagenMarca),
        claveProdServ: this.cleanNullableString(item.claveProdServ),
        claveUnidad: this.cleanNullableString(item.claveUnidad),
        unidad: this.cleanNullableString(item.unidad),
        almacen: item.almacen === null || item.almacen === undefined ? null : this.toNumber(item.almacen),
        precio,
        iva: this.toNumber(item.iva),
        lote: this.toNumber(item.lote),
        descuento,
        precioConDescuento,
      };
    });
  }

  private mapExistenciasRows(rows: any[]) {
    return rows.map((item) => ({
      almacen: this.toNumber(item.almacen),
      nombreAlmacen: this.cleanNullableString(item.nombreAlmacen),
      existencia: this.toNumber(item.existencia)
    }));
  }

  private mapUnidadesRows(rows: any[]) {
    return rows.map((item) => ({
      unidadId: this.toNumber(item.unidadId),
      unidad: this.cleanNullableString(item.unidad),
      equivale: this.toNumber(item.equivale),
    }));
  }

  private cleanNullableString(value: string | null | undefined): string | null {
    const cleanValue = (value ?? '').trim();
    return cleanValue ? cleanValue : null;
  }

  private resolveStaticTestClienteByLogin(numeroCliente: string, correo: string) {
    if (!this.isStaticTestClienteEnabled()) {
      return null;
    }

    if (numeroCliente !== this.staticTestNumeroCliente || correo !== this.staticTestCorreo) {
      return null;
    }

    return this.buildStaticTestCliente(true);
  }

  private isPlayReviewAccount(numeroCliente: string, correo: string) {
    return this.staticTestPlayReview
      && this.isStaticTestClienteEnabled()
      && numeroCliente === this.staticTestNumeroCliente
      && correo === this.staticTestCorreo;
  }

  private resolveStaticTestClienteById(clienteId: number, relations: string[] = []) {
    if (!this.isStaticTestClienteEnabled() || clienteId !== this.staticTestClienteId) {
      return null;
    }

    return this.buildStaticTestCliente(relations.includes('correos'));
  }

  private isStaticTestClienteEnabled() {
    return Boolean(this.staticTestNumeroCliente && this.staticTestCorreo && Number.isFinite(this.staticTestClienteId));
  }

  private buildStaticTestCliente(includeCorreos: boolean): Cliente {
    const cliente = this.clientesRepository.create({
      clienteId: this.staticTestClienteId,
      numero: this.staticTestNumeroCliente,
      nombre: this.staticTestNombre,
      activo: this.staticTestActivo,
      lista: 1,
      descuento: 0,
      limite: 0,
      saldo: 0,
    });

    cliente.correos = includeCorreos
      ? [
          this.correosRepository.create({
            clienteId: this.staticTestClienteId,
            correo: this.staticTestCorreo,
          }),
        ]
      : [];

    return cliente;
  }

  private normalizeNumeroCliente(numeroCliente: string | null | undefined): string {
    return (numeroCliente ?? '').trim();
  }

  private normalizeCorreo(correo: string | null | undefined): string {
    return (correo ?? '').trim().toLowerCase();
  }

  private generateOtpCode(): string {
    return `${randomInt(100000, 1000000)}`;
  }

  private generateSalt(): string {
    return randomBytes(16).toString('hex');
  }

  private hashOtp(salt: string, otp: string): string {
    return createHash('sha256').update(`${salt}:${otp}:${this.otpSecret}`).digest('hex');
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(`${refreshToken}:${this.refreshSecret}`).digest('hex');
  }

  private extractRequestMeta(request?: any) {
    const ip = request?.ip || request?.headers?.['x-forwarded-for'] || request?.socket?.remoteAddress || null;
    const userAgent = request?.headers?.['user-agent'] || null;

    return {
      ip: Array.isArray(ip) ? ip[0] : ip,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }

  private maskCorreo(correo: string): string {
    const [user, domain] = correo.split('@');
    if (!user || !domain) {
      return correo;
    }

    if (user.length <= 2) {
      return `${user[0] ?? '*'}*@${domain}`;
    }

    return `${user.slice(0, 2)}***@${domain}`;
  }

  private isClienteActivo(value: string | null | undefined): boolean {
    return ['S', 'A', '1', 'Y'].includes((value ?? '').trim().toUpperCase());
  }

  private buildFolio(serie: string | null | undefined, numero: number | string | null | undefined): string {
    const cleanSerie = (serie ?? '').trim();
    const cleanNumero = `${numero ?? ''}`.trim();

    if (cleanSerie && cleanNumero) {
      return `${cleanSerie}-${cleanNumero}`;
    }

    return cleanSerie || cleanNumero || 'SIN-FOLIO';
  }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private toDateOnly(value: Date | string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private diffInDays(dateA: Date, dateB: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((dateA.getTime() - dateB.getTime()) / msPerDay);
  }

  private toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private toMoney(value: string | number | null | undefined): number {
    return Number(this.toNumber(value).toFixed(2));
  }

  private formatDate(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
