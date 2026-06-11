import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class GetCfdiOptionsDto {
  @ApiProperty({ example: 'AAA010101AAA' })
  @IsString()
  @Length(12, 13)
  rfc: string;
}
