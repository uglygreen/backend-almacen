import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendTestPushDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  body?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
