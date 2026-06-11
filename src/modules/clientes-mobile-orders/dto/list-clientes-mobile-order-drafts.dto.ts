import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ClienteMobileOrderStatus } from '../entities/cliente-mobile-order.entity';

export class ListClientesMobileOrdersDto {
  @ApiPropertyOptional({ example: '07810' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  customer?: string;

  @ApiPropertyOptional({ enum: [ClienteMobileOrderStatus.DRAFT, ClienteMobileOrderStatus.SUBMITTED], example: ClienteMobileOrderStatus.DRAFT })
  @IsOptional()
  @IsEnum([ClienteMobileOrderStatus.DRAFT, ClienteMobileOrderStatus.SUBMITTED])
  status?: ClienteMobileOrderStatus.DRAFT | ClienteMobileOrderStatus.SUBMITTED;
}
