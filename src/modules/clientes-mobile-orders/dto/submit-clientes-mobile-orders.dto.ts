import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsPositive } from 'class-validator';

export class SubmitClientesMobileOrdersDto {
  @ApiProperty({ type: [Number], example: [101, 102] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  orderIds: number[];
}
