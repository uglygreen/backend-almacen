import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, Min, ValidateNested } from 'class-validator';

export const PERSONAL_BASE_AREAS = ['almacen', 'asesor', 'chofer', 'apoyo', 'auxiliar'] as const;
export const PERSONAL_BASE_SECCIONES = ['almacen', 'zona01', 'zona02', 'chofer01', 'chofer02', 'apoyo', 'auxiliar'] as const;

export class UpdatePersonalBaseConfigDto {
  @ApiProperty({ example: 'chofer', enum: PERSONAL_BASE_AREAS })
  @IsIn(PERSONAL_BASE_AREAS)
  area: string;

  @ApiProperty({ example: 'zona01', enum: PERSONAL_BASE_SECCIONES })
  @IsIn(PERSONAL_BASE_SECCIONES)
  seccion: string;

  @ApiProperty({ example: 10, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  basePersonal: number;
}

export class UpdateManyPersonalBaseConfigDto {
  @ApiProperty({ type: [UpdatePersonalBaseConfigDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePersonalBaseConfigDto)
  configuraciones: UpdatePersonalBaseConfigDto[];
}
