import { OnModuleInit } from '@nestjs/common';
import { ClinicProfile } from './clinic-profile';
export declare function clinicsRoot(): string;
export declare class ClinicProfileService implements OnModuleInit {
    private readonly root;
    private readonly logger;
    private defaults;
    private byNet;
    constructor(root?: string);
    onModuleInit(): void;
    reload(): void;
    forNet(clinicNetId?: number | null): ClinicProfile;
    private readYaml;
}
