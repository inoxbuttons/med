export type LlmProvider = 'openai' | 'gigachat';

export type MessageRole = 'system' | 'user' | 'assistant' | 'function';

/** Internal chat message — covers both plain text and tool-call turns */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  /** For role='function': name of the tool whose result this is */
  name?: string;
  /** For role='assistant': GigaChat function_call the model requested */
  function_call?: { name: string; arguments: string };
  /** GigaChat-specific state id returned in assistant tool-call messages */
  functions_state_id?: string;
}

/** Тип МИС, передаётся виджетом как параметр. Null — используется локальная БД. */
export type MisType = 'infoclinica' | 'medflex' | null;

/** Данные пациента, получаемые с сайта клиники и хранящиеся в сессии. */
export interface PatientData {
  firstName: string;
  lastName: string;
  secondName?: string;
  /** Телефон в формате 79XXXXXXXXX (11 цифр) — используется как patient_id в MedFlex */
  phone: string;
  /** Дата рождения YYYY-MM-DD */
  birthday: string;
}

/**
 * Гибридно-зашифрованный payload с данными пациента.
 * Схема: AES-256-GCM(данные) + RSA-OAEP(AES-ключ).
 * Шифруется публичным ключом клиники на сайте, расшифровывается на сервере.
 */
export interface EncryptedPatient {
  /** base64(RSA-OAEP зашифрованный AES-256 ключ) */
  k: string;
  /** base64(GCM IV, 12 байт) */
  iv: string;
  /** base64(AES-GCM ciphertext + 16-байтный auth tag) */
  d: string;
}

export interface SendMessageDto {
  sessionId: string;
  message: string;
  provider?: LlmProvider;
  model?: string;
  clientId?: number;
  clinicNetId?: number;
  /** Тип МИС: 'medflex', 'infoclinica'. Передаётся виджетом напрямую, не ищется в БД. */
  misType?: MisType;
  /** ID города (MedFlex town_id) для геофильтрации. Зарезервировано. */
  townId?: number;
  /** ID района (MedFlex district_id) для геофильтрации. Зарезервировано. */
  districtId?: number;
  /**
   * Зашифрованные данные пациента с сайта клиники.
   * Расшифровываются на первом запросе и сохраняются в session.patient.
   * После расшифровки в session.patient — дальше не нужны.
   */
  encryptedPatient?: EncryptedPatient;
}

export interface SendMessageResponse {
  sessionId: string;
  reply: string;
  history: ChatMessage[];
}

export interface PendingConflict {
  /** ID записи в локальной БД (только для local mis). */
  oldId: number;
  oldType: 'doctor' | 'service';
  /** UUID записи MedFlex — используется для отмены при resolving конфликта. */
  oldUuid?: string;
  /** Описание существующей записи для показа пациенту. */
  existingDescription?: string;
  newDoctorId?: number;
  newServiceId?: number;
  newClinicId: number;
  newStartTime: string;
  /**
   * Полные аргументы для повторного вызова book_appointment (MedFlex).
   * Хранятся, чтобы переиспользовать при замене записи без повторного ввода данных.
   */
  pendingBookingArgs?: Record<string, any>;
}

export type SessionState = 'idle' | 'conflict_resolution';

export interface SessionData {
  messages: ChatMessage[];
  provider: LlmProvider;
  model?: string;
  clientId?: number;
  clinicNetId?: number;
  /** Тип МИС, установленный при первом запросе сессии. */
  misType?: MisType;
  /** ID города (MedFlex town_id) для геофильтрации расписания. */
  townId?: number;
  /** ID района (MedFlex district_id) для геофильтрации расписания. */
  districtId?: number;
  /**
   * Данные пациента, расшифрованные из encryptedPatient при инициализации сессии.
   * Используются для автозаполнения при записи (MedFlex и другие МИС).
   * phone используется как patient_id в MedFlex.
   */
  patient?: PatientData;
  pendingConflict?: PendingConflict;
  state: SessionState;
  createdAt: Date;
  updatedAt: Date;
}
