import { IsOptional, IsString, IsNumberString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetAsistenciaDto {
  @ApiPropertyOptional({ 
    description: 'Identificador de la sucursal o base de datos. Queretaro (principal) aloja Constituyentes (terminal 3) y Belen (terminal 8). Tequisquiapan (tequisquiapan) aloja su propia terminal 3.', 
    enum: ['principal', 'tequisquiapan'], 
    example: 'principal' 
  })
  @IsOptional()
  @IsString()
  @IsIn(['principal', 'tequisquiapan'])
  sucursal?: 'principal' | 'tequisquiapan';

  @ApiPropertyOptional({ 
    description: 'ID de la terminal del reloj checador (ej. 3 para Constituyentes/Tequisquiapan, 8 para Belen). Si se omite, trae de todas las terminales de esa sucursal/bd.', 
    example: '3' 
  })
  @IsOptional()
  @IsNumberString()
  terminalId?: string;

  @ApiPropertyOptional({ description: 'Fecha de inicio del reporte (YYYY-MM-DD)', example: '2023-10-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin del reporte (YYYY-MM-DD)', example: '2023-10-31' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'ID del departamento para filtrar', example: '1' })
  @IsOptional()
  @IsNumberString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'ID de la posición (zona) para filtrar', example: '2' })
  @IsOptional()
  @IsNumberString()
  positionId?: string;
}
