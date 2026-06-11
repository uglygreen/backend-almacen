import { ApiProperty } from '@nestjs/swagger';
import { Max, IsPositive } from 'class-validator';

export class UpdateClientesMobileOrderItemDto {
  @ApiProperty({ example: 3 })
  @IsPositive()
  @Max(999999)
  cantidad: number;
}
