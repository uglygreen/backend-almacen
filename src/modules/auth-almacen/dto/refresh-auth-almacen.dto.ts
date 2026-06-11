import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshAuthAlmacenDto {
  @ApiProperty()
  @IsString()
  @MinLength(16)
  refreshToken: string;
}
