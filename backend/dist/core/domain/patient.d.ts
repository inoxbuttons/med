export interface PatientData {
    firstName: string;
    lastName: string;
    secondName?: string;
    phone: string;
    birthday: string;
}
export interface PatientIdentity {
    clientId?: number;
    data?: PatientData;
    sessionRefs?: string[];
}
