import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyOtpClienteMobileDto {
  @IsString()
  @MaxLength(20)
  numeroCliente: string;

  @IsString()
  @MaxLength(60)
  correo: string;

  @IsString()
  @MinLength(4)
  @MaxLength(6)
  otp: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceId?: string;
}
