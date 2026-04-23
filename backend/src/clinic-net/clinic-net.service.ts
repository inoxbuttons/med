import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicNet } from '../database/entities/clinic-net.entity';

@Injectable()
export class ClinicNetService {
  constructor(
    @InjectRepository(ClinicNet)
    private readonly clinicNetRepo: Repository<ClinicNet>,
  ) {}

  async findOne(id: number): Promise<ClinicNet> {
    const clinicNet = await this.clinicNetRepo.findOne({ where: { id } });
    if (!clinicNet) throw new NotFoundException(`Сеть клиник #${id} не найдена`);
    return clinicNet;
  }
}
