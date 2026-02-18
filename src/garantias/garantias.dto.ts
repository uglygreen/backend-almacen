import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EstatusGarantia } from '../entities/garantia.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGarantiaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  clienteId?: number;

  @ApiProperty()
  @IsNotEmpty()
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
