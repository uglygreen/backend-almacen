import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ListProductosPromoMesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  catalogoId?: number;
}
