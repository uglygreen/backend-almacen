import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { EstatusGarantia } from '../entities/garantia.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGarantiaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  numCli?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  folio?: string;

  @ApiProperty()
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  productoId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facturaId?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  descripcionFalla: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefonoContacto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombreContacto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  perId?: number;
}

export class UpdateStatusDto {
  @ApiProperty({ enum: EstatusGarantia })
  @IsNotEmpty()
  @IsEnum(EstatusGarantia)
  nuevoEstatus: EstatusGarantia;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comentario?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  usuarioResponsable?: string; 
}
