export declare class NotificationLog {
    id: number;
    clinicNetId: number | null;
    externalApptId: string;
    appointmentType: string;
    messenger: string;
    chatId: string;
    offsetMinutes: number;
    sentAt: Date;
    status: string;
    errorMessage: string | null;
}
