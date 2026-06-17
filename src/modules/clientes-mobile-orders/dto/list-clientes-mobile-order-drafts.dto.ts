import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ClienteMobileOrderStatus } from '../entities/cliente-mobile-order.entity';

export class ListClientesMobileOrdersDto {
  @ApiPropertyOptional({ example: '07810' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  customer?: string;

  @ApiPropertyOptional({
    enum: Object.values(ClienteMobileOrderStatus),
    example: ClienteMobileOrderStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(ClienteMobileOrderStatus)
  status?: ClienteMobileOrderStatus;
}
