import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsPositive, IsString, Min } from "class-validator";


export class AsignarPedidoDto {
  @ApiProperty({ description: 'ID del usuario almacenista', example: 5 })
  @IsInt()
  userId: number;

  @ApiProperty({ enum: ['CC', 'AG'], description: 'Zona a la que se asigna' })
  @IsString() // Usamos string simple y validamos lógica en servicio, o enum
  zona: 'CC' | 'AG';
}

export class AsignarSiguienteDto {
    @ApiProperty({description: 'ID del usuario que solicita el siguiente pedido para surtir', example: 1})
    @IsInt()
    @IsPositive()
    userId: number;
}

export class ActualizarLineaDto {
  @ApiProperty({ description: 'Cantidad real encontrada', example: 5 })
  @IsInt()
  @Min(0)
  cantidadSurtida: number;

  @ApiProperty({ description: 'Nota si hubo incidencia', required: false })
  @IsOptional()
  @IsString()
  nota?: string;
}

export class EmpaquetarPedidoDto {
  @ApiProperty({
    description: 'Número total de bultos o cajas para el pedido.',
    example: 3,
  })
  @IsInt()
  @Min(1)
  numeroDeBultos: number;
}

export class FinalizarEtapaDto {
  @ApiProperty({ enum: ['CC', 'AG'] })
  @IsString()
  zona: 'CC' | 'AG';
}