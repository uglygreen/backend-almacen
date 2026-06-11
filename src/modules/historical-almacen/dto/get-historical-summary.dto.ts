import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class GetHistoricalSummaryDto {
  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  fechaInicio: string;

  @ApiProperty({ example: '2026-04-27' })
  @IsDateString()
  fechaFin: string;
}
