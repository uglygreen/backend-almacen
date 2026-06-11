import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsPositive, IsString, Length } from 'class-validator';

export class ValidateOrderAlmacenDto {
  @ApiProperty({ example: 1001 })
  @IsInt()
  @IsPositive()
  operatorId: number;

  @ApiProperty({ example: '1' })
  @IsString()
  @Length(1, 5)
  serie: string;

  @ApiProperty({ example: 12345 })
  @IsInt()
  @IsPositive()
  folio: number;

  @ApiProperty({ example: 'AL', enum: ['AL', 'CC'] })
  @IsEnum(['AL', 'CC'])
  location: 'AL' | 'CC';
}
