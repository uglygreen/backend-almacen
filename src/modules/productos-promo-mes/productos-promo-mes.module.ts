import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClienteMobileSession } from '../../entities';
import { AuthAlmacenModule } from '../auth-almacen/auth-almacen.module';
import { ClientesMobileAuthGuard } from '../clientes-mobile/clientes-mobile-auth.guard';
import { CatalogoPromoMes } from './entities/catalogo-promo-mes.entity';
import { ProductoPromoMes } from './entities/producto-promo-mes.entity';
import { ProductosPromoMesAdminController } from './productos-promo-mes-admin.controller';
import { ProductosPromoMesMobileController } from './productos-promo-mes-mobile.controller';
import { ProductosPromoMesService } from './productos-promo-mes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatalogoPromoMes, ProductoPromoMes, ClienteMobileSession]),
    JwtModule.register({}),
    AuthAlmacenModule,
  ],
  controllers: [
    ProductosPromoMesAdminController,
    ProductosPromoMesMobileController,
  ],
  providers: [ProductosPromoMesService, ClientesMobileAuthGuard],
  exports: [ProductosPromoMesService],
})
export class ProductosPromoMesModule {}
