import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(255)
  fcmToken: string;

  @IsString()
  @IsIn(['android', 'ios', 'web'])
  platform: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}
