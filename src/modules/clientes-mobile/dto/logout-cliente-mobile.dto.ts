import { IsString } from 'class-validator';

export class LogoutClienteMobileDto {
  @IsString()
  refreshToken: string;
}
