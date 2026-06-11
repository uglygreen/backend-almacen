import { PartialType } from '@nestjs/swagger';
import { CreateClientesMobileOrderDraftDto } from './create-clientes-mobile-order-draft.dto';

export class UpdateClientesMobileOrderDraftDto extends PartialType(CreateClientesMobileOrderDraftDto) {}
