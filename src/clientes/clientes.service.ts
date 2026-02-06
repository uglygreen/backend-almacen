import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Cliente } from '../entities/cliente.entity';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente, 'legacy_db')
    private readonly clienteRepo: Repository<Cliente>,
  ) {}

  // Obtener todos los clientes (paginados para no saturar)
  async findAll(page: number = 1, limit: number = 100) {
    return this.clienteRepo.find({
      take: limit,
      skip: (page - 1) * limit,
    });
  }

  // Obtener cliente por ID
  async findOne(id: number) {
    return this.clienteRepo.findOne({ where: { clienteId: id } });
  }

   // Obtener cliente por numero
  async findOneByNumber(numero: string) {
    return this.clienteRepo.findOne({ where: { numero: numero } });
  }

  // Clientes Activos
  async findActivos() {
    return this.clienteRepo.find({
      where: { activo: 'S' }, // Asumiendo 'S' es Sí
      take: 100,
    });
  }

  // Clientes Deudores (Saldo > 0)
  async findDeudores() {
    return this.clienteRepo.find({
      where: {
        saldo: MoreThan(0),
      },
      order: { saldo: 'DESC' },
      take: 100,
    });
  }
}
