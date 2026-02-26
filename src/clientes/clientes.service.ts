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
    return this.clienteRepo.createQueryBuilder('cliente')
      .leftJoin('cliente.vendedorDetalle', 'vendedor')
      .addSelect(['vendedor.perId', 'vendedor.nombre', 'vendedor.xCategoria']) // Solo columnas relevantes
      .take(limit)
      .skip((page - 1) * limit)
      .getMany();
  }

  // Obtener cliente por ID
  async findOne(id: number) {
    return this.clienteRepo.createQueryBuilder('cliente')
      .leftJoin('cliente.vendedorDetalle', 'vendedor')
      .addSelect(['vendedor.perId', 'vendedor.nombre', 'vendedor.xCategoria', 'vendedor.tel1', 'vendedor.ceCorreo'])
      .where('cliente.clienteId = :id', { id })
      .getOne();
  }

   // Obtener cliente por numero
  async findOneByNumber(numero: string) {
    return this.clienteRepo.createQueryBuilder('cliente')
      .leftJoin('cliente.vendedorDetalle', 'vendedor')
      .addSelect(['vendedor.perId', 'vendedor.nombre', 'vendedor.xCategoria', 'vendedor.tel1', 'vendedor.ceCorreo'])
      .where('cliente.numero = :numero', { numero })
      .getOne();
  }

  // Clientes Activos
  async findActivos() {
    return this.clienteRepo.createQueryBuilder('cliente')
      .leftJoin('cliente.vendedorDetalle', 'vendedor')
      .addSelect(['vendedor.perId', 'vendedor.nombre', 'vendedor.xCategoria'])
      .where("cliente.activo = :activo", { activo: 'S' }) // Asumiendo 'S' es Sí
      .take(100)
      .getMany();
  }

  // Clientes Deudores (Saldo > 0)
  async findDeudores() {
    return this.clienteRepo.createQueryBuilder('cliente')
      .leftJoin('cliente.vendedorDetalle', 'vendedor')
      .addSelect(['vendedor.perId', 'vendedor.nombre', 'vendedor.xCategoria'])
      .where("cliente.saldo > :saldo", { saldo: 0 })
      .orderBy('cliente.saldo', 'DESC')
      .take(100)
      .getMany();
  }
}
