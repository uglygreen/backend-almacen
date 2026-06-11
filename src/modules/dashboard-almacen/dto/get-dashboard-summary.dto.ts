import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class GetDashboardSummaryDto {
  @ApiPropertyOptional({ example: '2026-04-27' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
