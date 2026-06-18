import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BackofficePersonRefDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  nombre: string;
}

export class BackofficeCustomerAddressDto {
  @ApiProperty()
  id: number;

  @ApiPropertyOptional()
  nombre: string | null;

  @ApiPropertyOptional()
  nombreComercial: string | null;

  @ApiPropertyOptional()
  direccion: string | null;

  @ApiPropertyOptional()
  numero: string | null;

  @ApiPropertyOptional()
  interior: string | null;

  @ApiPropertyOptional()
  colonia: string | null;

  @ApiPropertyOptional()
  ciudad: string | null;

  @ApiPropertyOptional()
  municipio: string | null;

  @ApiPropertyOptional()
  estado: string | null;

  @ApiPropertyOptional()
  pais: string | null;

  @ApiPropertyOptional()
  referencia: string | null;

  @ApiPropertyOptional()
  cp: string | null;

  @ApiPropertyOptional()
  rfc: string | null;

  @ApiPropertyOptional()
  regimen: string | null;

  @ApiPropertyOptional()
  medio: string | null;

  @ApiPropertyOptional()
  validado: string | null;
}

export class BackofficeCustomerDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  numero: string;

  @ApiPropertyOptional()
  nombre: string | null;

  @ApiProperty()
  activo: boolean;

  @ApiPropertyOptional()
  email: string | null;

  @ApiPropertyOptional()
  descuento: number | null;

  @ApiPropertyOptional()
  descuentoCredito: number | null;

  @ApiPropertyOptional()
  vendedor: BackofficePersonRefDto | null;

  @ApiPropertyOptional()
  cobrador: BackofficePersonRefDto | null;

  @ApiPropertyOptional()
  direccionPrincipal: BackofficeCustomerAddressDto | null;
}

export class BackofficeOrderBillingDto {
  @ApiPropertyOptional()
  rfc: string | null;

  @ApiPropertyOptional()
  cfdiUse: string | null;
}

export class BackofficeOrderDeliveryDto {
  @ApiPropertyOptional()
  type: string | null;

  @ApiPropertyOptional()
  addressId: number | null;

  @ApiPropertyOptional()
  address: BackofficeCustomerAddressDto | null;
}

export class BackofficeOrderSummaryDto {
  @ApiProperty()
  itemsCount: number;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  iva: number;

  @ApiProperty()
  total: number;
}

export class BackofficeCreditCustomerSnapshotDto {
  @ApiPropertyOptional()
  id: number | null;

  @ApiPropertyOptional()
  nombre: string | null;

  @ApiPropertyOptional()
  rfc: string | null;

  @ApiPropertyOptional()
  activo: boolean | null;

  @ApiPropertyOptional()
  lineaCredito: number | null;

  @ApiPropertyOptional()
  saldoActual: number | null;

  @ApiPropertyOptional()
  creditoDisponible: number | null;
}

export class BackofficeCreditAccountsReceivableDto {
  @ApiPropertyOptional()
  totalAdeudo: number | null;

  @ApiPropertyOptional()
  facturasVencidas: number | null;

  @ApiPropertyOptional()
  diasMaximoAtraso: number | null;

  @ApiProperty({ type: [Object] })
  detalleResumen: Array<Record<string, unknown>>;
}

export class BackofficeCreditStatusDto {
  @ApiPropertyOptional()
  clave: string | null;

  @ApiPropertyOptional()
  descripcion: string | null;

  @ApiPropertyOptional()
  puedeGenerarPedido: boolean | null;

  @ApiPropertyOptional()
  puedeGenerarCotizacion: boolean | null;

  @ApiPropertyOptional()
  mensaje: string | null;
}

export class BackofficeCreditRulesDto {
  @ApiPropertyOptional()
  tipo: string | null;

  @ApiPropertyOptional()
  detalle: string | null;
}

export class BackofficeCreditDto {
  @ApiPropertyOptional()
  capturedAt: string | null;

  @ApiPropertyOptional()
  customer: BackofficeCreditCustomerSnapshotDto | null;

  @ApiPropertyOptional()
  accountsReceivable: BackofficeCreditAccountsReceivableDto | null;

  @ApiPropertyOptional()
  status: BackofficeCreditStatusDto | null;

  @ApiPropertyOptional()
  rules: BackofficeCreditRulesDto | null;
}

export class BackofficeOrderItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  productId: number;

  @ApiProperty()
  sku: string;

  @ApiProperty()
  descripcion: string;

  @ApiPropertyOptional()
  imagen: string | null;

  @ApiPropertyOptional()
  claveProdServ: string | null;

  @ApiPropertyOptional()
  claveUnidad: string | null;

  @ApiPropertyOptional()
  unidad: string | null;

  @ApiPropertyOptional()
  almacen: number | null;

  @ApiProperty()
  cantidad: number;

  @ApiPropertyOptional()
  lote: string | null;

  @ApiProperty()
  precioUnitario: number;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  iva: number;

  @ApiProperty()
  total: number;
}

export class BackofficeSubmittedOrderListItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  submittedAt: Date | null;

  @ApiPropertyOptional()
  createdAt: Date | null;

  @ApiPropertyOptional()
  updatedAt: Date | null;

  @ApiProperty()
  customer: BackofficeCustomerDto;

  @ApiProperty()
  billing: BackofficeOrderBillingDto;

  @ApiProperty()
  delivery: BackofficeOrderDeliveryDto;

  @ApiProperty()
  summary: BackofficeOrderSummaryDto;
}

export class BackofficeSubmittedOrderDetailDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  submittedAt: Date | null;

  @ApiPropertyOptional()
  createdAt: Date | null;

  @ApiPropertyOptional()
  updatedAt: Date | null;

  @ApiPropertyOptional()
  nota: string | null;

  @ApiProperty()
  customer: BackofficeCustomerDto;

  @ApiProperty()
  billing: BackofficeOrderBillingDto;

  @ApiProperty()
  delivery: BackofficeOrderDeliveryDto;

  @ApiProperty()
  summary: BackofficeOrderSummaryDto;

  @ApiPropertyOptional()
  credit: BackofficeCreditDto | null;

  @ApiProperty({ type: [BackofficeOrderItemDto] })
  items: BackofficeOrderItemDto[];
}
