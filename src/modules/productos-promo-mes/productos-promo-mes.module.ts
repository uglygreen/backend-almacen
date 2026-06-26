import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientesMobileModule } from '../clientes-mobile/clientes-mobile.module';
import { AuthAlmacenModule } from '../auth-almacen/auth-almacen.module';
import { CatalogoPromoMes } from './entities/catalogo-promo-mes.entity';
import { ProductoPromoMes } from './entities/producto-promo-mes.entity';
import { ProductosPromoMesAdminController } from './productos-promo-mes-admin.controller';
import { ProductosPromoMesMobileController } from './productos-promo-mes-mobile.controller';
import { ProductosPromoMesService } from './productos-promo-mes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatalogoPromoMes, ProductoPromoMes]),
    AuthAlmacenModule,
    ClientesMobileModule,
  ],
  controllers: [
    ProductosPromoMesAdminController,
    ProductosPromoMesMobileController,
  ],
  providers: [ProductosPromoMesService],
  exports: [ProductosPromoMesService],
})
export class ProductosPromoMesModule {}
