import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { AddClientesMobileOrderItemDto } from './add-clientes-mobile-order-item.dto';
import { ClienteMobileOrderDeliveryType } from '../entities/cliente-mobile-order.entity';

export class CreateClientesMobileOrderDraftDto {
  @ApiPropertyOptional({ enum: ClienteMobileOrderDeliveryType, example: ClienteMobileOrderDeliveryType.DELIVERY })
  @IsOptional()
  @IsEnum(ClienteMobileOrderDeliveryType)
  deliveryType?: ClienteMobileOrderDeliveryType;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  addressId?: number;

  @ApiPropertyOptional({ example: 'XAXX010101000' })
  @IsOptional()
  @IsString()
  @Length(12, 13)
  rfc?: string;

  @ApiPropertyOptional({ example: 'S01' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  cfdiUse?: string;

  @ApiPropertyOptional({ type: [AddClientesMobileOrderItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddClientesMobileOrderItemDto)
  items?: AddClientesMobileOrderItemDto[];
}
