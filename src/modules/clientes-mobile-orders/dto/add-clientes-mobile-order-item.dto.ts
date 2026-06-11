import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString, Length, Max } from 'class-validator';

export class AddClientesMobileOrderItemDto {
  @ApiProperty({ example: 12345 })
  @IsInt()
  @IsPositive()
  productId: number;

  @ApiProperty({ example: 2 })
  @IsPositive()
  @Max(999999)
  cantidad: number;

  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  lote?: string;

  @ApiPropertyOptional({ example: 'https://ferremayoristas.com.mx/assets/photos-img/martillo.webp' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  imagen?: string;
}
