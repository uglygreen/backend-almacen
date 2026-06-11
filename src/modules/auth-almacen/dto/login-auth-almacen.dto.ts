import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class LoginAuthAlmacenDto {
  @ApiProperty({ description: 'ID del almacenista', example: 1001 })
  @IsInt({ message: 'operatorId debe ser entero' })
  @IsPositive({ message: 'operatorId debe ser positivo' })
  operatorId: number;
}
