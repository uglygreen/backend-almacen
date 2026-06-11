import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, Length, MinLength } from 'class-validator';

export class CreateSurtidoAlmacenDto {
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

  @ApiProperty({ example: 'captura-1001-1-12345-AL', required: false })
  @IsOptional()
  @IsString()
  @MinLength(8)
  idempotencyKey?: string;
}
