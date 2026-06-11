import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ClientesMobileAuthGuard } from '../clientes-mobile/clientes-mobile-auth.guard';
import { CustomerNotificationsService } from './customer-notifications.service';
import { DeactivateDeviceTokenDto } from './dto/deactivate-device-token.dto';
import { ListCustomerNotificationsDto } from './dto/list-customer-notifications.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { SendTestPushDto } from './dto/send-test-push.dto';

@ApiTags('Clientes Mobile Notifications')
@Controller('clientes-mobile/v1')
export class CustomerNotificationsController {
  constructor(
    private readonly customerNotificationsService: CustomerNotificationsService,
  ) {}

  @Post('device-tokens')
  @UseGuards(ClientesMobileAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registra o reactiva un token FCM del cliente autenticado' })
  registerDeviceToken(@Req() req: any, @Body() dto: RegisterDeviceTokenDto) {
    return this.customerNotificationsService.registerDeviceToken(req.user.sub, dto);
  }

  @Post('device-tokens/deactivate')
  @UseGuards(ClientesMobileAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactiva un token FCM del cliente autenticado' })
  deactivateDeviceToken(@Req() req: any, @Body() dto: DeactivateDeviceTokenDto) {
    return this.customerNotificationsService.deactivateDeviceToken(req.user.sub, dto);
  }

  @Post('notifications/test-push')
  @UseGuards(ClientesMobileAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envia una notificacion push de prueba al cliente autenticado' })
  sendTestPush(@Req() req: any, @Body() dto: SendTestPushDto) {
    return this.customerNotificationsService.sendTestPush(req.user.sub, dto);
  }

  @Get('notifications')
  @UseGuards(ClientesMobileAuthGuard)
  @ApiOperation({ summary: 'Lista el historial de notificaciones push del cliente autenticado' })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean, example: false })
  listNotifications(@Req() req: any, @Query() query: ListCustomerNotificationsDto) {
    return this.customerNotificationsService.listCustomerNotifications(req.user.sub, query);
  }

  @Patch('notifications/:id/read')
  @UseGuards(ClientesMobileAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marca una notificación como leída' })
  markNotificationAsRead(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.customerNotificationsService.markAsRead(req.user.sub, id);
  }

  @Delete('notifications/:id')
  @UseGuards(ClientesMobileAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Oculta una notificación del historial del usuario' })
  deleteNotification(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.customerNotificationsService.deleteFromHistory(req.user.sub, id);
  }
}
