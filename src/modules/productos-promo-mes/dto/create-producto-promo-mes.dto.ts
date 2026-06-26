import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductoPromoMesDto {
  private static normalizeBoolean(value: unknown) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      return value.trim().toLowerCase() === 'true';
    }

    return value;
  }

  @Type(() => Number)
  @IsInt()
  @Min(1)
  catalogoId: number;

  @IsString()
  @MaxLength(40)
  codigo: string;

  @Transform(({ value }) => CreateProductoPromoMesDto.normalizeBoolean(value))
  @IsBoolean()
  enCatalogo: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paginaCatalogo?: number;

  @Transform(({ value }) => CreateProductoPromoMesDto.normalizeBoolean(value))
  @IsBoolean()
  fueraDeCatalogo: boolean;
}
