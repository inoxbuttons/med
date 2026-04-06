import { MedField } from './med-field.entity';
import { ServiceByClinic } from './service-by-clinic.entity';
export declare class Service {
    id: number;
    medFieldId: number;
    medField: MedField;
    name: string;
    description: string;
    servicesByClinics: ServiceByClinic[];
}
