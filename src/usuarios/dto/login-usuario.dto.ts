import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive } from 'class-validator';

export class LoginUsuarioDto {
  @ApiProperty({ description: 'ID del almacenista', example: 1 })
  @IsInt({ message: 'El idAlmacenista debe ser un número entero' })
  @IsPositive({ message: 'El idAlmacenista debe ser un número positivo' })
  idAlmacenista: number;
}