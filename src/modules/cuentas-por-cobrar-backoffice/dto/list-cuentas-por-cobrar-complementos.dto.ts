import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListCuentasPorCobrarComplementosDto {
  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Fecha inicial en formato YYYY-MM-DD',
  })
  @IsDateString()
  from!: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Fecha final en formato YYYY-MM-DD',
  })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({
    example: 2421,
    description: 'Identificador interno del cliente en legacy',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clienteId?: number;

  @ApiPropertyOptional({
    example: '19043',
    description: 'Numero de cliente en legacy',
  })
  @IsOptional()
  @IsString()
  numeroCliente?: string;
}
