import { IsString } from 'class-validator';

export class RefreshClienteMobileDto {
  @IsString()
  refreshToken: string;
}
