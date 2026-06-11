import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ClienteMobileOrderStatus } from '../../clientes-mobile-orders/entities/cliente-mobile-order.entity';

export class ListClientesMobileOrdersBackofficeDto {
  @ApiPropertyOptional({
    enum: [ClienteMobileOrderStatus.SUBMITTED],
    example: ClienteMobileOrderStatus.SUBMITTED,
    default: ClienteMobileOrderStatus.SUBMITTED,
  })
  @IsOptional()
  @IsEnum([ClienteMobileOrderStatus.SUBMITTED])
  status?: ClienteMobileOrderStatus.SUBMITTED;

  @ApiPropertyOptional({ example: '07810' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  customer?: string;

  @ApiPropertyOptional({ example: 35037 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clienteId?: number;

  @ApiPropertyOptional({ example: 50, default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
