import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsDateString, IsOptional } from 'class-validator';

export class GetKpiVentasPorEstadoDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Fecha inicial en formato YYYY-MM-DD. Por defecto usa el inicio del anio actual.',
  })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiPropertyOptional({
    example: '2026-07-23',
    description: 'Fecha final en formato YYYY-MM-DD. Por defecto usa la fecha actual.',
  })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiPropertyOptional({
    example: 'true',
    description: "Cuando es true, solo considera facturas con XML timbrado, TIPDOC='F' y CFDMETODOPAGO='PPD'.",
  })
  @IsOptional()
  @IsBooleanString()
  soloTimbradas?: string;
}
