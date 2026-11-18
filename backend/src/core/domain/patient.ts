/** Данные пациента, переданные сайтом клиники (расшифрованы из payload) или собранные в диалоге. */
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
 * Кто записывается. clientId — id пациента в системе клиники (авторизован на сайте),
 * data — персональные данные (из payload сайта или собранные в диалоге).
 */
export interface PatientIdentity {
  clientId?: number;
  data?: PatientData;
  /** Записи, созданные в этом диалоге: гость может отменить/перенести их без входа в кабинет. */
  sessionRefs?: string[];
}
