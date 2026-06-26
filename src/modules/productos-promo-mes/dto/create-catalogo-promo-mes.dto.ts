import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCatalogoPromoMesDto {
  @IsString()
  @MaxLength(120)
  nombrePeriodo: string;

  @IsOptional()
  @IsDateString()
  fechaRegistro?: string;
}
