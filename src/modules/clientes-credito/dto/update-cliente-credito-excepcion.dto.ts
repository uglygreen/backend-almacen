import { PartialType } from '@nestjs/swagger';
import { CreateClienteCreditoExcepcionDto } from './create-cliente-credito-excepcion.dto';

export class UpdateClienteCreditoExcepcionDto extends PartialType(CreateClienteCreditoExcepcionDto) {}
