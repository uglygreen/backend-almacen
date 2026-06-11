import { IsString, MaxLength } from 'class-validator';

export class CreateClienteCreditoExcepcionDto {
  @IsString()
  @MaxLength(20)
  numeroCliente: string;
}
