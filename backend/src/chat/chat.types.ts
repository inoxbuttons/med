export type LlmProvider = 'openai' | 'gigachat' | 'qwen' | 'qwen3';

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

/** Данные пациента, получаемые с сайта клиники и хранящиеся в сессии. Определены в домене. */
import type { PatientData } from '../core/domain/patient';
export type { PatientData };

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
  /**
   * Нажатая кнопка (движок pipeline): "choice:2", "yes", "no", "book:service:<название>",
   * "book:doctor:<фамилия>". message при этом — подпись кнопки для истории.
   */
  payload?: string;
  /**
   * Принудительный выбор движка — только для тестов, работает при CHAT_ALLOW_ENGINE_OVERRIDE=true.
   * Иначе движок берётся из профиля сети.
   */
  engine?: 'tools' | 'pipeline';
}

export interface SendMessageResponse {
  sessionId: string;
  reply: string;
  history: ChatMessage[];
  /** Кнопки быстрого ответа (движок pipeline). */
  quickReplies?: Array<{ label: string; payload?: string }>;
  /** Каким движком обработан ход: tools (модель с инструментами) или pipeline. */
  engine?: 'tools' | 'pipeline';
}

/**
 * Сохранённый вызов book_appointment / reschedule_appointment, который был
 * заблокирован guard'ом «confirmation_required». На следующем ходе, если
 * пользователь сказал «да»/«подтверждаю», сервер сам исполнит этот вызов
 * — это страхует от галлюцинации LLM «успешно оформлено» без реального tool-call.
 */
export interface PendingConfirmation {
  toolName: 'book_appointment' | 'reschedule_appointment' | 'cancel_appointment';
  toolArgs: Record<string, any>;
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
  /** Версия собранного промпта (PromptBuilder) — пишется в token_usage. */
  promptHash?: string;
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
  /**
   * UUID-ы записей, созданных в текущей сессии (только MedFlex).
   * Хранятся для быстрой отмены/переноса без дополнительного `get_patient_appointments`.
   */
  recentBookings?: Array<{ uuid: string; description: string; startTime: string }>;
  pendingConflict?: PendingConflict;
  /**
   * Сохранённые args вызова book/reschedule, ожидающего подтверждения.
   * Снимается на следующем ходе: либо сервер исполняет (если "да"), либо отменяется (любой другой ответ).
   */
  pendingConfirmation?: PendingConfirmation;
  /**
   * Заметки о завершённых записях формата [Завершённая запись] …
   * Строятся в момент book_appointment.success (когда search-результаты ещё
   * в session.messages — оттуда берутся ФИО, специальность, услуга, клиника).
   * foldCompletedBookings заменяет ими session.messages на следующем ходе.
   */
  completedBookingNotes?: string[];
  /** Сколько заметок уже свёрнуто в session.messages — fold не повторяется без новых записей. */
  foldedNotesCount?: number;
  state: SessionState;
  createdAt: Date;
  updatedAt: Date;
}
