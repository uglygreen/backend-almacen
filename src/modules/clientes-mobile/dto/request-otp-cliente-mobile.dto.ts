import { IsString, MaxLength } from 'class-validator';

export class RequestOtpClienteMobileDto {
  @IsString()
  @MaxLength(20)
  numeroCliente: string;

  @IsString()
  @MaxLength(60)
  correo: string;
}
