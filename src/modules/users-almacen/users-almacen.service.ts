import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlmacenUser } from '../../entities';
import { ListActiveUsersByGroupDto } from './dto/list-active-users-by-group.dto';

@Injectable()
export class UsersAlmacenService {
  constructor(
    @InjectRepository(AlmacenUser)
    private readonly almacenUserRepository: Repository<AlmacenUser>,
  ) {}

  async getActiveUsers() {
    const users = await this.almacenUserRepository.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });

    return users.map((user) => ({
      id: user.id,
      nombre: user.nombre,
      usuario: user.usuario,
      area: user.area,
      seccion: user.seccion,
      activo: Boolean(user.activo),
    }));
  }

  async getUserStatus(id: number) {
    const user = await this.almacenUserRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`No existe el almacenista ${id}`);
    }

    return {
      id: user.id,
      nombre: user.nombre,
      usuario: user.usuario,
      area: user.area,
      seccion: user.seccion,
      activo: Boolean(user.activo),
    };
  }

  async getActiveUsersByGroup(query: ListActiveUsersByGroupDto) {
    const area = this.normalizeValue(query.area);
    const seccion = this.normalizeValue(query.seccion);

    const users = await this.almacenUserRepository.find({
      where: {
        activo: true,
        area,
        seccion,
      },
      select: {
        id: true,
        nombre: true,
      },
      order: { nombre: 'ASC' },
    });

    return users.map((user) => ({
      id: user.id,
      nombre: user.nombre,
    }));
  }

  private normalizeValue(value: string) {
    return (value ?? '').trim().toLowerCase();
  }


}
