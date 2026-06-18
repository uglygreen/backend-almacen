import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClienteMobileOrderStatus } from '../../clientes-mobile-orders/entities/cliente-mobile-order.entity';

export class UpdateClientesMobileOrderStatusDto {
  @ApiProperty({
    enum: ClienteMobileOrderStatus,
    example: ClienteMobileOrderStatus.ACCEPTED,
  })
  @IsEnum(ClienteMobileOrderStatus)
  status: ClienteMobileOrderStatus;

  @ApiPropertyOptional({
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyCustomer?: boolean;

  @ApiPropertyOptional({
    example: 'Tu pedido ya esta siendo surtido en almacen.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  message?: string;

  @ApiPropertyOptional({
    example: 'intranet',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  changedBy?: string;
}
