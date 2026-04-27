import { Repository } from 'typeorm';
import { ClinicNet } from '../database/entities/clinic-net.entity';
export declare class ClinicNetService {
    private readonly clinicNetRepo;
    constructor(clinicNetRepo: Repository<ClinicNet>);
    findOne(id: number): Promise<ClinicNet>;
}
