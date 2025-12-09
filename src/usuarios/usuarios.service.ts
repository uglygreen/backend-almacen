import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AlmacenUser } from 'src/entities';
import { Repository } from 'typeorm';
import { LoginUsuarioDto } from './dto/login-usuario.dto';


@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(AlmacenUser)
    private readonly almacenUserRepository: Repository<AlmacenUser>,
  ) {}

  async login(loginUsuarioDto: LoginUsuarioDto): Promise<AlmacenUser> {
    const { idAlmacenista } = loginUsuarioDto;

    const usuario = await this.almacenUserRepository.findOne({
      where: { 
        id: idAlmacenista,
        area: 'almacen'
      },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${idAlmacenista} no encontrado.`);
    }

    if (!usuario.activo) {
      throw new UnauthorizedException(`El usuario ${usuario.nombre} no está activo.`);
    }

    return usuario;
  }
}
