import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeactivateDeviceTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(255)
  fcmToken: string;
}
