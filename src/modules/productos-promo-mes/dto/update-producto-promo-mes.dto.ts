import { PartialType } from '@nestjs/mapped-types';
import { CreateProductoPromoMesDto } from './create-producto-promo-mes.dto';

export class UpdateProductoPromoMesDto extends PartialType(
  CreateProductoPromoMesDto,
) {}
