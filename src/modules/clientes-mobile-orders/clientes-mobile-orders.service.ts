import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Cliente } from '../../entities';
import { DomLegacy } from '../../entities/dom-legacy.entity';
import { envString } from '../../config/runtime-env';
import { ClientesCreditoService } from '../clientes-credito/clientes-credito.service';
import { AddClientesMobileOrderItemDto } from './dto/add-clientes-mobile-order-item.dto';
import { CreateClientesMobileOrderDraftDto } from './dto/create-clientes-mobile-order-draft.dto';
import { ListClientesMobileOrdersDto } from './dto/list-clientes-mobile-order-drafts.dto';
import { SubmitClientesMobileOrdersDto } from './dto/submit-clientes-mobile-orders.dto';
import { UpdateClientesMobileOrderDraftDto } from './dto/update-clientes-mobile-order-draft.dto';
import { UpdateClientesMobileOrderItemDto } from './dto/update-clientes-mobile-order-item.dto';
import {
  ClienteMobileOrder,
  ClienteMobileOrderDeliveryType,
  ClienteMobileOrderStatus,
} from './entities/cliente-mobile-order.entity';
import { ClienteMobileOrderItem } from './entities/cliente-mobile-order-item.entity';

type CatalogProductRow = {
  id: number;
  codigo: string | null;
  clave: string | null;
  descripcion: string | null;
  imagen: string | null;
  claveProdServ: string | null;
  claveUnidad: string | null;
  unidad: string | null;
  almacen: number | null;
  lote: number;
  iva: number;
  precioRegular: number;
  precioDescuento: number;
};

type OrderValidationSummary = {
  canSubmit: boolean;
  reasons: string[];
};

const GENERIC_RFC_VALUES = new Set(['XAXX010101000', 'XEXX010101000']);

const CFDI_OPTIONS = [
  { code: 'G01', description: 'Adquisicion de mercancias' },
  { code: 'G02', description: 'Devoluciones, descuentos o bonificaciones' },
  { code: 'G03', description: 'Gastos en general' },
  { code: 'I01', description: 'Construcciones' },
  { code: 'I02', description: 'Mobilario y equipo de oficina por inversiones' },
  { code: 'I03', description: 'Equipo de transporte' },
  { code: 'I04', description: 'Equipo de computo y accesorios' },
  { code: 'I05', description: 'Dados, troqueles, moldes, matrices y herramental' },
  { code: 'I06', description: 'Comunicaciones telefonicas' },
  { code: 'I08', description: 'Otra maquinaria y equipo' },
  { code: 'S01', description: 'Sin efectos fiscales' },
];

@Injectable()
export class ClientesMobileOrdersService {
  private readonly catalogImageBaseUrl = envString(
    'CLIENTES_MOBILE_CATALOG_IMAGE_BASE_URL',
    'https://ferremayoristas.com.mx/assets/photos-img/',
  );

  constructor(
    @InjectRepository(ClienteMobileOrder)
    private readonly ordersRepository: Repository<ClienteMobileOrder>,
    @InjectRepository(ClienteMobileOrderItem)
    private readonly orderItemsRepository: Repository<ClienteMobileOrderItem>,
    @InjectRepository(Cliente, 'legacy_db')
    private readonly clientesRepository: Repository<Cliente>,
    @InjectDataSource('legacy_db')
    private readonly legacyDataSource: DataSource,
    private readonly clientesCreditoService: ClientesCreditoService,
  ) {}

  async listOrders(
    clienteId: number,
    numeroCliente: string,
    query: ListClientesMobileOrdersDto,
  ) {
    const requestedCustomer = this.normalizeNumeroCliente(query.customer);
    if (requestedCustomer && requestedCustomer !== this.normalizeNumeroCliente(numeroCliente)) {
      throw new ForbiddenException('Solo puedes consultar los pedidos de tu cuenta');
    }

    const status = query.status ?? ClienteMobileOrderStatus.DRAFT;
    const orders = await this.ordersRepository.find({
      where: {
        clienteId,
        status,
      },
      relations: ['items'],
      order: {
        updatedAt: 'DESC',
        id: 'DESC',
      },
    });

    if (status === ClienteMobileOrderStatus.DRAFT) {
      await this.refreshDraftOrdersPricing(orders);
    }

    return {
      items: orders.map((order) => this.mapOrder(order)),
    };
  }

  async createDraft(
    clienteId: number,
    numeroCliente: string,
    dto: CreateClientesMobileOrderDraftDto,
  ) {
    const cliente = await this.findClienteById(clienteId, ['domicilioPrincipal', 'domicilios']);
    const order = this.ordersRepository.create({
      clienteId,
      clienteNumero: this.normalizeNumeroCliente(numeroCliente || cliente.numero) ?? cliente.numero.trim(),
      status: ClienteMobileOrderStatus.DRAFT,
      subtotal: 0,
      iva: 0,
      total: 0,
      deliveryType: null,
      addressId: null,
      addressSnapshot: null,
      rfc: null,
      cfdiUse: null,
      creditSnapshot: null,
      nota: null,
      submittedAt: null,
    });

    await this.applyDraftConfiguration(order, cliente, dto);
    const savedOrder = await this.ordersRepository.save(order);

    for (const item of dto.items ?? []) {
      await this.addItem(clienteId, savedOrder.id, item);
    }

    return this.getDraft(clienteId, savedOrder.id);
  }

  async getDraft(clienteId: number, orderId: number) {
    const order = await this.findOwnedOrder(clienteId, orderId, ClienteMobileOrderStatus.DRAFT);
    await this.refreshDraftOrdersPricing([order]);
    return {
      order: this.mapOrder(order),
    };
  }

  async updateDraft(
    clienteId: number,
    orderId: number,
    dto: UpdateClientesMobileOrderDraftDto,
  ) {
    const order = await this.findOwnedOrder(clienteId, orderId, ClienteMobileOrderStatus.DRAFT);
    const cliente = await this.findClienteById(clienteId, ['domicilioPrincipal', 'domicilios']);

    await this.applyDraftConfiguration(order, cliente, dto);
    const saved = await this.ordersRepository.save(order);

    return {
      order: this.mapOrder(await this.findOwnedOrder(clienteId, saved.id, ClienteMobileOrderStatus.DRAFT)),
    };
  }

  async deleteDraft(clienteId: number, orderId: number) {
    const order = await this.findOwnedOrder(clienteId, orderId, ClienteMobileOrderStatus.DRAFT);
    await this.ordersRepository.delete(order.id);

    return {
      deleted: true,
      orderId: order.id,
      removedItems: order.items?.length ?? 0,
    };
  }

  async addItem(
    clienteId: number,
    orderId: number,
    dto: AddClientesMobileOrderItemDto,
  ) {
    const order = await this.findOwnedOrder(clienteId, orderId, ClienteMobileOrderStatus.DRAFT);
    const product = await this.findCatalogProductById(dto.productId);
    const lote = this.cleanNullableString(dto.lote) ?? this.resolveProductLote(product);
    const imagen = this.resolveOrderItemImage(dto.imagen, product.imagen);

    const existingQuery = this.orderItemsRepository
      .createQueryBuilder('item')
      .where('item.pedidoId = :pedidoId', { pedidoId: order.id })
      .andWhere('item.productId = :productId', { productId: dto.productId });

    if (lote === null) {
      existingQuery.andWhere('item.lote IS NULL');
    } else {
      existingQuery.andWhere('item.lote = :lote', { lote });
    }

    const existing = await existingQuery.getOne();

    if (existing) {
      existing.cantidad = this.roundTo(
        this.toNumber(existing.cantidad) + this.toNumber(dto.cantidad),
        2,
      );
      existing.imagen = imagen ?? existing.imagen ?? null;
      this.recalculateItem(existing);
      await this.orderItemsRepository.save(existing);
    } else {
      const newItem = this.orderItemsRepository.create(
        this.buildOrderItemFromProduct(order.id, product, dto.cantidad, lote, imagen),
      );
      await this.orderItemsRepository.save(newItem);
    }

    return {
      order: this.mapOrder(await this.recalculateAndReloadOrder(clienteId, order.id)),
    };
  }

  async updateItem(
    clienteId: number,
    orderId: number,
    itemId: number,
    dto: UpdateClientesMobileOrderItemDto,
  ) {
    await this.findOwnedOrder(clienteId, orderId, ClienteMobileOrderStatus.DRAFT);
    const item = await this.orderItemsRepository.findOne({
      where: {
        id: itemId,
        pedidoId: orderId,
      },
    });

    if (!item) {
      throw new NotFoundException(`No se encontró el item ${itemId} en el pedido ${orderId}`);
    }

    item.cantidad = this.roundTo(dto.cantidad, 2);
    this.recalculateItem(item);
    await this.orderItemsRepository.save(item);

    return {
      order: this.mapOrder(await this.recalculateAndReloadOrder(clienteId, orderId)),
    };
  }

  async removeItem(clienteId: number, orderId: number, itemId: number) {
    await this.findOwnedOrder(clienteId, orderId, ClienteMobileOrderStatus.DRAFT);

    const item = await this.orderItemsRepository.findOne({
      where: {
        id: itemId,
        pedidoId: orderId,
      },
    });

    if (!item) {
      throw new NotFoundException(`No se encontró el item ${itemId} en el pedido ${orderId}`);
    }

    await this.orderItemsRepository.delete(item.id);

    return {
      order: this.mapOrder(await this.recalculateAndReloadOrder(clienteId, orderId)),
    };
  }

  async submitOrders(clienteId: number, dto: SubmitClientesMobileOrdersDto) {
    const cliente = await this.findClienteById(clienteId, ['domicilioPrincipal', 'domicilios']);
    const uniqueOrderIds = [...new Set(dto.orderIds)];
    const orders = await this.ordersRepository.find({
      where: {
        id: In(uniqueOrderIds),
        clienteId,
        status: ClienteMobileOrderStatus.DRAFT,
      },
      relations: ['items'],
      order: {
        id: 'ASC',
      },
    });

    if (orders.length !== uniqueOrderIds.length) {
      const foundIds = new Set(orders.map((order) => order.id));
      const missingIds = uniqueOrderIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`No se encontraron los drafts solicitados: ${missingIds.join(', ')}`);
    }

    await this.refreshDraftOrdersPricing(orders);

    const creditSummary = await this.clientesCreditoService.getResumenCliente(clienteId);
    if (!creditSummary?.estatus_credito?.puede_generar_pedido) {
      throw new BadRequestException(
        creditSummary?.estatus_credito?.mensaje || 'El cliente no tiene permitido generar pedidos',
      );
    }

    const submittedAt = new Date();
    for (const order of orders) {
      this.ensureDraftCanBeSubmitted(order);
      await this.ensureFiscalData(order, cliente);

      order.creditSnapshot = this.buildCreditSnapshot(creditSummary);
      order.nota = this.buildSubmittedOrderNote(order, submittedAt);
      order.status = ClienteMobileOrderStatus.SUBMITTED;
      order.submittedAt = submittedAt;
    }

    await this.ordersRepository.save(orders);

    const submittedOrders = await this.ordersRepository.find({
      where: {
        id: In(uniqueOrderIds),
        clienteId,
      },
      relations: ['items'],
      order: {
        id: 'ASC',
      },
    });

    return {
      submitted: true,
      count: submittedOrders.length,
      orders: submittedOrders.map((order) => this.mapOrder(order)),
    };
  }

  async getOrder(clienteId: number, orderId: number) {
    const order = await this.findOwnedOrder(clienteId, orderId);
    if (order.status === ClienteMobileOrderStatus.DRAFT) {
      await this.refreshDraftOrdersPricing([order]);
    }
    return {
      order: this.mapOrder(order),
    };
  }

  async getAddresses(clienteId: number) {
    const cliente = await this.findClienteById(clienteId, ['domicilioPrincipal', 'domicilios']);
    const primaryAddressId = cliente.domicilioPrincipal?.domId ?? null;
    const uniqueAddresses = new Map<number, DomLegacy>();

    for (const address of cliente.domicilios ?? []) {
      if (address?.domId) {
        uniqueAddresses.set(address.domId, address);
      }
    }

    if (cliente.domicilioPrincipal?.domId) {
      uniqueAddresses.set(cliente.domicilioPrincipal.domId, cliente.domicilioPrincipal);
    }

    const items = [...uniqueAddresses.values()]
      .sort((a, b) => Number(b.domId === primaryAddressId) - Number(a.domId === primaryAddressId) || a.domId - b.domId)
      .map((address) => ({
        ...this.serializeAddress(address),
        isPrimary: address.domId === primaryAddressId,
      }));

    return {
      items,
    };
  }

  getCfdiOptions(rfc: string) {
    const normalizedRfc = this.normalizeRfc(rfc);
    if (!normalizedRfc) {
      throw new BadRequestException('RFC requerido');
    }

    if (!this.isValidRfc(normalizedRfc)) {
      throw new BadRequestException('RFC inválido');
    }

    const isGeneric = this.isGenericRfc(normalizedRfc);
    const options = isGeneric
      ? CFDI_OPTIONS.filter((item) => item.code === 'S01')
      : CFDI_OPTIONS;

    return {
      rfc: normalizedRfc,
      isGeneric,
      fixedValue: isGeneric ? 'S01' : null,
      options,
    };
  }

  private async applyDraftConfiguration(
    order: ClienteMobileOrder,
    cliente: Cliente,
    dto: Partial<CreateClientesMobileOrderDraftDto>,
  ) {
    if (dto.deliveryType !== undefined) {
      order.deliveryType = dto.deliveryType ?? null;
    }

    if (dto.addressId !== undefined) {
      const address = await this.findClienteAddress(cliente, dto.addressId);
      order.addressId = address.domId;
      order.addressSnapshot = this.serializeAddress(address);

      if (dto.rfc === undefined) {
        order.rfc = this.normalizeRfc(address.rfc) ?? null;
      }
    }

    if (dto.rfc !== undefined) {
      order.rfc = this.normalizeRfc(dto.rfc);
    }

    if (dto.cfdiUse !== undefined) {
      order.cfdiUse = this.normalizeCfdiUse(dto.cfdiUse);
    }

    this.normalizeFiscalData(order);
  }

  private normalizeFiscalData(order: ClienteMobileOrder) {
    if (!order.rfc && order.addressSnapshot?.rfc) {
      order.rfc = this.normalizeRfc(order.addressSnapshot.rfc);
    }

    if (order.rfc && !this.isValidRfc(order.rfc)) {
      throw new BadRequestException('RFC inválido para el pedido');
    }

    if (order.rfc && this.isGenericRfc(order.rfc)) {
      order.cfdiUse = 'S01';
      return;
    }

    if (order.cfdiUse) {
      const normalizedCfdi = this.normalizeCfdiUse(order.cfdiUse);
      if (!normalizedCfdi || !this.isAllowedCfdi(normalizedCfdi)) {
        throw new BadRequestException('Uso CFDI inválido');
      }

      order.cfdiUse = normalizedCfdi;
    }
  }

  private ensureDraftCanBeSubmitted(order: ClienteMobileOrder) {
    const validation = this.buildDraftValidation(order);
    if (!validation.canSubmit) {
      throw new BadRequestException(
        `El pedido ${order.id} no puede enviarse: ${validation.reasons.join(', ')}`,
      );
    }
  }

  private async ensureFiscalData(order: ClienteMobileOrder, cliente: Cliente) {
    if (order.addressId && !order.addressSnapshot) {
      const address = await this.findClienteAddress(cliente, order.addressId);
      order.addressSnapshot = this.serializeAddress(address);
    }

    this.normalizeFiscalData(order);
  }

  private buildDraftValidation(order: ClienteMobileOrder): OrderValidationSummary {
    const reasons: string[] = [];

    if (!order.items?.length) {
      reasons.push('debe incluir al menos un producto');
    }

    if (!order.deliveryType) {
      reasons.push('falta definir el tipo de entrega');
    }

    if (!order.addressId || !order.addressSnapshot) {
      reasons.push('falta seleccionar la direccion del pedido');
    }

    if (!order.rfc) {
      reasons.push('falta capturar el RFC');
    } else if (!this.isValidRfc(order.rfc)) {
      reasons.push('el RFC es invalido');
    }

    if (!order.cfdiUse) {
      reasons.push('falta definir el uso CFDI');
    } else if (this.isGenericRfc(order.rfc ?? '') && order.cfdiUse !== 'S01') {
      reasons.push('para RFC generico el uso CFDI debe ser S01');
    } else if (!this.isGenericRfc(order.rfc ?? '') && !this.isAllowedCfdi(order.cfdiUse)) {
      reasons.push('el uso CFDI no es valido');
    }

    return {
      canSubmit: reasons.length === 0,
      reasons,
    };
  }

  private buildCreditSnapshot(summary: any) {
    return {
      capturedAt: new Date().toISOString(),
      cliente: summary?.cliente ?? null,
      cobranza: summary?.cobranza ?? null,
      estatusCredito: summary?.estatus_credito ?? null,
      reglasAplicadas: summary?.reglas_aplicadas ?? null,
    };
  }

  private buildSubmittedOrderNote(order: ClienteMobileOrder, submittedAt: Date) {
    const reference = this.buildOrderReference(order, submittedAt);
    const parts = ['APP:MOBILE', `REF:${reference}`];

    if (order.deliveryType === ClienteMobileOrderDeliveryType.PICKUP) {
      parts.push('CLIENTE RECOGE EN OFICINA');
    } else if (order.deliveryType === ClienteMobileOrderDeliveryType.DELIVERY) {
      parts.push('ENTREGA A DOMICILIO');
    }

    return parts.join('|');
  }

  private buildOrderReference(order: ClienteMobileOrder, submittedAt: Date) {
    const datePart = submittedAt.toISOString().slice(0, 10).replace(/-/g, '');
    const suffixSeed = [
      order.id,
      order.clienteId,
      this.normalizeNumeroCliente(order.clienteNumero) ?? '',
      this.toMoney(order.total).toFixed(2),
      order.items?.length ?? 0,
      order.deliveryType ?? '',
      order.addressId ?? '',
    ].join('|');

    return `MOB-${datePart}-${order.id}-${this.buildReferenceSuffix(suffixSeed)}`;
  }

  private buildReferenceSuffix(seed: string) {
    let hash = 0;
    for (const char of seed) {
      hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
    }

    return hash.toString(36).toUpperCase().padStart(6, '0').slice(-6);
  }

  private buildOrderItemFromProduct(
    pedidoId: number,
    product: CatalogProductRow,
    cantidad: number,
    lote: string | null,
    imagen: string | null,
  ) {
    const ivaRate = this.toNumber(product.iva);
    const unitTotal = this.toMoney(
      this.toNumber(product.precioDescuento) > 0
        ? product.precioDescuento
        : product.precioRegular,
    );
    const unitSubtotal = ivaRate > 0
      ? this.roundTo(unitTotal / (1 + ivaRate / 100), 4)
      : this.roundTo(unitTotal, 4);

    const item = {
      pedidoId,
      productId: product.id,
      sku: this.cleanNullableString(product.codigo) ?? this.cleanNullableString(product.clave) ?? product.id.toString(),
      descripcion: this.cleanNullableString(product.descripcion) ?? `Producto ${product.id}`,
      imagen,
      claveProdServ: this.cleanNullableString(product.claveProdServ),
      claveUnidad: this.cleanNullableString(product.claveUnidad),
      unidad: this.cleanNullableString(product.unidad),
      almacen: product.almacen === null || product.almacen === undefined ? null : this.toNumber(product.almacen),
      cantidad: this.roundTo(cantidad, 2),
      lote,
      precioUnitario: unitSubtotal,
      ivaRate,
      iva: 0,
      subtotal: 0,
      total: 0,
    };

    return this.recalculateItem(item);
  }

  private recalculateItem<T extends {
    cantidad: number;
    precioUnitario: number;
    ivaRate: number;
    subtotal: number;
    iva: number;
    total: number;
  }>(item: T) {
    const cantidad = this.roundTo(this.toNumber(item.cantidad), 2);
    const subtotal = this.toMoney(this.toNumber(item.precioUnitario) * cantidad);
    const iva = this.toMoney(subtotal * (this.toNumber(item.ivaRate) / 100));
    const total = this.toMoney(subtotal + iva);

    item.cantidad = cantidad;
    item.subtotal = subtotal;
    item.iva = iva;
    item.total = total;

    return item;
  }

  private async refreshDraftOrdersPricing(orders: ClienteMobileOrder[]) {
    const draftOrders = orders.filter(
      (order) => order.status === ClienteMobileOrderStatus.DRAFT && (order.items?.length ?? 0) > 0,
    );
    if (!draftOrders.length) {
      return;
    }

    const productIds = [...new Set(
      draftOrders.flatMap((order) => (order.items ?? []).map((item) => item.productId)),
    )];
    const productsById = await this.findCatalogProductsByIds(productIds);
    const itemsToSave: ClienteMobileOrderItem[] = [];
    const ordersToSave: ClienteMobileOrder[] = [];

    for (const order of draftOrders) {
      let orderChanged = false;

      for (const item of order.items ?? []) {
        const product = productsById.get(item.productId);
        if (!product) {
          continue;
        }

        if (this.refreshDraftItemPricing(item, product)) {
          itemsToSave.push(item);
          orderChanged = true;
        }
      }

      if (this.recalculateOrderTotals(order)) {
        orderChanged = true;
      }

      if (orderChanged) {
        ordersToSave.push(order);
      }
    }

    if (itemsToSave.length) {
      await this.orderItemsRepository.save(itemsToSave);
    }

    if (ordersToSave.length) {
      await this.ordersRepository.save(ordersToSave);
    }
  }

  private async recalculateAndReloadOrder(clienteId: number, orderId: number) {
    const order = await this.findOwnedOrder(clienteId, orderId);
    this.recalculateOrderTotals(order);
    await this.ordersRepository.save(order);

    return this.findOwnedOrder(clienteId, orderId);
  }

  private refreshDraftItemPricing(item: ClienteMobileOrderItem, product: CatalogProductRow) {
    const refreshedItem = this.buildOrderItemFromProduct(
      item.pedidoId,
      product,
      this.toNumber(item.cantidad),
      item.lote,
      product.imagen ?? item.imagen ?? null,
    );

    const nextSku = refreshedItem.sku;
    const nextDescripcion = refreshedItem.descripcion;
    const nextImagen = refreshedItem.imagen;
    const nextClaveProdServ = refreshedItem.claveProdServ;
    const nextClaveUnidad = refreshedItem.claveUnidad;
    const nextUnidad = refreshedItem.unidad;
    const nextAlmacen =
      refreshedItem.almacen === null || refreshedItem.almacen === undefined
        ? null
        : this.toNumber(refreshedItem.almacen);
    const nextPrecioUnitario = this.roundTo(refreshedItem.precioUnitario, 4);
    const nextIvaRate = this.roundTo(refreshedItem.ivaRate, 4);
    const nextSubtotal = this.toMoney(refreshedItem.subtotal);
    const nextIva = this.toMoney(refreshedItem.iva);
    const nextTotal = this.toMoney(refreshedItem.total);

    const changed =
      item.sku !== nextSku
      || item.descripcion !== nextDescripcion
      || (item.imagen ?? null) !== nextImagen
      || (item.claveProdServ ?? null) !== nextClaveProdServ
      || (item.claveUnidad ?? null) !== nextClaveUnidad
      || (item.unidad ?? null) !== nextUnidad
      || (item.almacen ?? null) !== nextAlmacen
      || this.roundTo(item.precioUnitario, 4) !== nextPrecioUnitario
      || this.roundTo(item.ivaRate, 4) !== nextIvaRate
      || this.toMoney(item.subtotal) !== nextSubtotal
      || this.toMoney(item.iva) !== nextIva
      || this.toMoney(item.total) !== nextTotal;

    item.sku = nextSku;
    item.descripcion = nextDescripcion;
    item.imagen = nextImagen;
    item.claveProdServ = nextClaveProdServ;
    item.claveUnidad = nextClaveUnidad;
    item.unidad = nextUnidad;
    item.almacen = nextAlmacen;
    item.precioUnitario = nextPrecioUnitario;
    item.ivaRate = nextIvaRate;
    item.subtotal = nextSubtotal;
    item.iva = nextIva;
    item.total = nextTotal;

    return changed;
  }

  private recalculateOrderTotals(order: ClienteMobileOrder) {
    const items = order.items ?? [];
    const nextSubtotal = this.toMoney(
      items.reduce((sum, item) => sum + this.toNumber(item.subtotal), 0),
    );
    const nextIva = this.toMoney(
      items.reduce((sum, item) => sum + this.toNumber(item.iva), 0),
    );
    const nextTotal = this.toMoney(
      items.reduce((sum, item) => sum + this.toNumber(item.total), 0),
    );

    const changed =
      this.toMoney(order.subtotal) !== nextSubtotal
      || this.toMoney(order.iva) !== nextIva
      || this.toMoney(order.total) !== nextTotal;

    order.subtotal = nextSubtotal;
    order.iva = nextIva;
    order.total = nextTotal;

    return changed;
  }

  private mapOrder(order: ClienteMobileOrder) {
    const validation = this.buildDraftValidation(order);
    return {
      id: order.id,
      clienteId: order.clienteId,
      clienteNumero: order.clienteNumero,
      status: order.status,
      deliveryType: order.deliveryType,
      addressId: order.addressId,
      addressSnapshot: order.addressSnapshot,
      rfc: order.rfc,
      cfdiUse: order.cfdiUse,
      totals: {
        subtotal: this.toMoney(order.subtotal),
        iva: this.toMoney(order.iva),
        total: this.toMoney(order.total),
      },
      creditSnapshot: order.creditSnapshot,
      nota: order.nota,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        sku: item.sku,
        descripcion: item.descripcion,
        imagen: item.imagen,
        claveProdServ: item.claveProdServ,
        claveUnidad: item.claveUnidad,
        unidad: item.unidad,
        almacen: item.almacen,
        cantidad: this.toNumber(item.cantidad),
        lote: item.lote,
        precioUnitario: this.toNumber(item.precioUnitario),
        iva: this.toMoney(item.iva),
        subtotal: this.toMoney(item.subtotal),
        total: this.toMoney(item.total),
      })),
      validation,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      submittedAt: order.submittedAt,
    };
  }

  private async findOwnedOrder(
    clienteId: number,
    orderId: number,
    status?: ClienteMobileOrderStatus,
  ) {
    const where: Record<string, any> = {
      id: orderId,
      clienteId,
    };

    if (status) {
      where.status = status;
    }

    const order = await this.ordersRepository.findOne({
      where,
      relations: ['items'],
      order: {
        items: {
          id: 'ASC',
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`No se encontró el pedido ${orderId}`);
    }

    return order;
  }

  private async findClienteById(clienteId: number, relations: string[] = []) {
    const cliente = await this.clientesRepository.findOne({
      where: { clienteId },
      relations,
    });

    if (!cliente) {
      throw new NotFoundException(`No se encontró el cliente ${clienteId}`);
    }

    return cliente;
  }

  private async findClienteAddress(cliente: Cliente, addressId: number) {
    const addresses = [...(cliente.domicilios ?? [])];
    if (cliente.domicilioPrincipal?.domId) {
      addresses.push(cliente.domicilioPrincipal);
    }

    const address = addresses.find((item) => item.domId === addressId);
    if (!address) {
      throw new BadRequestException(`La direccion ${addressId} no pertenece al cliente autenticado`);
    }

    return address;
  }

  private async findCatalogProductById(productId: number): Promise<CatalogProductRow> {
    const productsById = await this.findCatalogProductsByIds([productId]);
    const product = productsById.get(productId);
    if (!product) {
      throw new NotFoundException(`No se encontró el producto ${productId}`);
    }

    return product;
  }

  private async findCatalogProductsByIds(productIds: number[]) {
    const uniqueIds = [...new Set(productIds.map((id) => this.toNumber(id)).filter((id) => id > 0))];
    if (!uniqueIds.length) {
      return new Map<number, CatalogProductRow>();
    }

    const placeholders = uniqueIds.map(() => '?').join(', ');
    const rows = await this.legacyDataSource.query(
      `
        SELECT
          inv.ARTICULOID AS id,
          TRIM(inv.CLVPROV) AS codigo,
          TRIM(inv.CLAVE) AS clave,
          TRIM(inv.DESCRIPCIO) AS descripcion,
          TRIM(inv.XIMAGEN2) AS imagen,
          CASE
            WHEN inv.CLAVEPRODSERV IS NULL THEN NULL
            ELSE LPAD(TRIM(CAST(inv.CLAVEPRODSERV AS CHAR)), 8, '0')
          END AS claveProdServ,
          'H87' AS claveUnidad,
          TRIM(uni.UNIDAD) AS unidad,
          alm.ALMACEN AS almacen,
          IFNULL(inv.LOTE, 0) AS lote,
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
          AND alm.ALMACEN = inv.ALMDEF
        WHERE inv.ARTICULOID IN (${placeholders})
          AND pre.NPRECIO = 1
          AND TRIM(COALESCE(inv.CLVPROV, '')) <> ''
          AND inv.CATALOGO IN ('0', '1', '2')
      `,
      uniqueIds,
    );

    const products = new Map<number, CatalogProductRow>();
    for (const product of rows ?? []) {
      const mappedProduct = {
        id: this.toNumber(product.id),
        codigo: this.cleanNullableString(product.codigo),
        clave: this.cleanNullableString(product.clave),
        descripcion: this.cleanNullableString(product.descripcion),
        imagen: this.buildCatalogImageUrl(product.imagen),
        claveProdServ: this.cleanNullableString(product.claveProdServ),
        claveUnidad: this.cleanNullableString(product.claveUnidad),
        unidad: this.cleanNullableString(product.unidad),
        almacen: product.almacen === null || product.almacen === undefined ? null : this.toNumber(product.almacen),
        lote: this.toNumber(product.lote),
        iva: this.toNumber(product.iva),
        precioRegular: this.toMoney(product.precioRegular),
        precioDescuento: this.toMoney(product.precioDescuento),
      };

      products.set(mappedProduct.id, mappedProduct);
    }

    return products;
  }

  private serializeAddress(address: DomLegacy) {
    return {
      id: address.domId,
      nombre: this.cleanNullableString(address.nombre),
      nombreComercial: this.cleanNullableString(address.nombreCom),
      direccion: this.cleanNullableString(address.direccion),
      numero: this.cleanNullableString(address.numero),
      interior: this.cleanNullableString(address.interior),
      colonia: this.cleanNullableString(address.colonia),
      ciudad: this.cleanNullableString(address.ciudad),
      municipio: this.cleanNullableString(address.municipio),
      estado: this.cleanNullableString(address.estado),
      pais: this.cleanNullableString(address.pais),
      referencia: this.cleanNullableString(address.referencia),
      cp: this.cleanNullableString(address.cp),
      rfc: this.normalizeRfc(address.rfc),
      regimen: this.cleanNullableString(address.domRegimen),
      medio: this.cleanNullableString(address.medio),
      validado: this.cleanNullableString(address.validado),
    };
  }

  private resolveOrderItemImage(dtoImage: string | null | undefined, catalogImage: string | null) {
    return this.cleanNullableString(dtoImage) ?? catalogImage ?? null;
  }

  private buildCatalogImageUrl(imageName: string | null | undefined) {
    const cleanImageName = this.cleanNullableString(imageName);
    if (!cleanImageName) {
      return null;
    }

    if (/^https?:\/\//i.test(cleanImageName)) {
      return cleanImageName;
    }

    const baseUrl = this.catalogImageBaseUrl.endsWith('/')
      ? this.catalogImageBaseUrl
      : `${this.catalogImageBaseUrl}/`;

    const fileName = cleanImageName.replace(/\.[^.]+$/i, '.webp');
    return `${baseUrl}${encodeURIComponent(fileName)}`;
  }

  private normalizeNumeroCliente(value: string | null | undefined) {
    const normalized = (value ?? '').trim();
    return normalized || null;
  }

  private normalizeRfc(value: string | null | undefined) {
    const normalized = (value ?? '').trim().toUpperCase();
    return normalized || null;
  }

  private normalizeCfdiUse(value: string | null | undefined) {
    const normalized = (value ?? '').trim().toUpperCase();
    return normalized || null;
  }

  private isGenericRfc(value: string) {
    return GENERIC_RFC_VALUES.has(this.normalizeRfc(value) ?? '');
  }

  private isValidRfc(value: string) {
    const normalized = this.normalizeRfc(value);
    if (!normalized) {
      return false;
    }

    return /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(normalized);
  }

  private isAllowedCfdi(value: string) {
    const normalized = this.normalizeCfdiUse(value);
    return CFDI_OPTIONS.some((item) => item.code === normalized);
  }

  private resolveProductLote(product: CatalogProductRow) {
    return this.toNumber(product.lote) > 0 ? product.lote.toString() : null;
  }

  private cleanNullableString(value: string | null | undefined) {
    const normalized = (value ?? '').trim();
    return normalized || null;
  }

  private toNumber(value: unknown) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private roundTo(value: number, decimals: number) {
    const factor = 10 ** decimals;
    return Math.round((this.toNumber(value) + Number.EPSILON) * factor) / factor;
  }

  private toMoney(value: unknown) {
    return this.roundTo(this.toNumber(value), 2);
  }
}
