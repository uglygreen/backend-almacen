import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Personal } from 'src/entities/personal.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PersonalService {
  constructor(
    @InjectRepository(Personal, 'legacy_db')
    private readonly personalRepository: Repository<Personal>,
  ) {}

  // Definimos las columnas que realmente importan para el front-end
  private readonly columnasRelevantes: (keyof Personal)[] = [
    'perId',
    'nombre',
    'categoria',
    'grupo',
    'perfil',
    'estado',
    'ceCorreo',
    'tel1',
    'tel2',
    'direccion',
    'colonia',
    'ciudad',
    'rfc',
    'curp',
    'ingreso',
    'xCategoria', // <-- Columna obligatoria según tus requerimientos
  ];

  async findById(id: number): Promise<Personal> {
    const empleado = await this.personalRepository.findOne({
      where: { perId: id },
      select: this.columnasRelevantes,
    });

    if (!empleado) {
      throw new NotFoundException(`El empleado con ID ${id} no fue encontrado`);
    }

    return empleado;
  }

  async findSinPerfil(): Promise<Personal[]> {
    // Como la columna en BD es NOT NULL, un campo vacío se guarda como '' (string vacío)
    return await this.personalRepository.find({
      where: { perfil: '' }, 
      select: this.columnasRelevantes,
    });
  }
}