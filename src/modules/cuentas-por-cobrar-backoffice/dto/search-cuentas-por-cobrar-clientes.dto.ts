import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchCuentasPorCobrarClientesDto {
  @ApiPropertyOptional({
    example: 'ferremayoristas',
    description: 'Texto libre para buscar por nombre o numero de cliente',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'MARIA GABRIELA',
    description: 'Filtro específico por nombre de cliente',
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    example: '19043',
    description: 'Filtro específico por numero de cliente',
  })
  @IsOptional()
  @IsString()
  numero?: string;

  @ApiPropertyOptional({
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;
}
