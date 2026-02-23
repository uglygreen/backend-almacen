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
  @IsInt()
  @Type(() => Number)
  facturaId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  numFactura?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  descripcionFalla: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefonoContacto?: string;

  @ApiPropertyOptional({ description: 'Nombre de quien entrega el producto' })
  @IsOptional()
  @IsString()
  nombreContacto?: string;

  @ApiProperty({ description: 'ID del asesor que registra la garantía' })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  asesorId: number;

  @ApiPropertyOptional({ 
    description: 'ID del chofer que recolectará. Si el asesor la trae consigo, enviar su propio ID' 
  })
  @IsOptional()
  @IsString()
  choferRecoleccionId?: string;

  @ApiPropertyOptional({ 
    enum: EstatusGarantia, 
    default: EstatusGarantia.PENDIENTE_REVISION 
  })
  @IsOptional()
  @IsEnum(EstatusGarantia)
  estatusActual?: EstatusGarantia;
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

  @IsOptional()
  @IsString()
  choferRecoleccionId?: string; // Para estados de recolección

  @IsOptional()
  @IsString()
  choferEntregaId?: string; // Para estados de envío a cliente
}
