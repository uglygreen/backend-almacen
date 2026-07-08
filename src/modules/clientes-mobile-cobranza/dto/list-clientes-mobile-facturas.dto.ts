import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class ListClientesMobileFacturasDto {
  @ApiPropertyOptional({ example: '2026-07-01', description: 'Fecha inicial del rango en formato YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-31', description: 'Fecha final del rango en formato YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 5, default: 5, enum: [5, 10] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([5, 10])
  limit?: number;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Incluye los complementos de pago relacionados con cada factura en la página actual',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = `${value ?? ''}`.trim().toLowerCase();
    return ['1', 'true', 's', 'si', 'yes'].includes(normalized);
  })
  @IsBoolean()
  includeComplementos?: boolean;
}
