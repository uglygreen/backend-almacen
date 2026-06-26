import { PartialType } from '@nestjs/mapped-types';
import { CreateCatalogoPromoMesDto } from './create-catalogo-promo-mes.dto';

export class UpdateCatalogoPromoMesDto extends PartialType(
  CreateCatalogoPromoMesDto,
) {}
