import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthAlmacenGuard } from '../auth-almacen/auth-almacen.guard';
import { ListActiveUsersByGroupDto } from './dto/list-active-users-by-group.dto';
import { UsersAlmacenService } from './users-almacen.service';

// @UseGuards(AuthAlmacenGuard)
@ApiTags('Users Almacen')
@Controller('almacen/v1/users')
export class UsersAlmacenController {
  constructor(private readonly usersAlmacenService: UsersAlmacenService) {}

  @Get('active')
  @ApiOperation({ summary: 'Obtiene el catálogo de almacenistas activos' })
  getActiveUsers() {
    return this.usersAlmacenService.getActiveUsers();
  }

  @Get('active/group')
  @ApiOperation({ summary: 'Obtiene usuarios activos por area y seccion, devolviendo solo id y nombre' })
  @ApiQuery({ name: 'area', required: true, type: String, example: 'almacen' })
  @ApiQuery({ name: 'seccion', required: true, type: String, example: 'almacen' })
  getActiveUsersByGroup(@Query() query: ListActiveUsersByGroupDto) {
    return this.usersAlmacenService.getActiveUsersByGroup(query);
  }

  @Get('active/:id')
  @ApiOperation({ summary: 'Obtiene el estado de un almacenista activo o inactivo' })
  getUserStatus(@Param('id', ParseIntPipe) id: number) {
    return this.usersAlmacenService.getUserStatus(id);
  }
}
