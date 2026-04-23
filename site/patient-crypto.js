/**
 * Шифрование данных пациента перед передачей в iframe чата.
 * Схема: AES-256-GCM(данные) + RSA-OAEP-SHA256(AES-ключ).
 * Публичный ключ соответствует приватному ключу сервера (PATIENT_DATA_PRIVATE_KEY).
 */

const PATIENT_DATA_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwJKs8m77lsDKDXzib1Ax
fDA8zHVxsUKu4UNektVql5IdF6EBd9W6s4kke4rpVup4bj14Qwrnoqe2BMJ7QKIq
xA5CzR+R9FdIxLIuUzUX7MuB8CJA83vmIsaM5HqYFEOpUwVgnIyKCZCWDqrFNK1R
LlPhKJoM8ZHB0YgeSMiJiFz8Zp43QxM7r1NVNqlNENVE/84zkuXXOPaWu8EcJCkj
v7ltF4hroAOb2KRTZKAckZcgnclH5MSFXEPUtipVDXSU7iqnWdsJYKFTa9V+rsw3
+w6apBe5cM/vTlmi0iKVk+s5SMF4dLZsON7O1Gkui7+QfSNoYobo58hBivREIFNr
DQIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Импортирует PEM-публичный ключ в формат CryptoKey для WebCrypto API.
 */
async function importPublicKey(pem) {
  const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, '');
  const binaryDer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki',
    binaryDer.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );
}

/**
 * Шифрует данные пациента.
 * @param {object} patient - { firstName, lastName, secondName?, phone, birthday }
 * @returns {Promise<{k: string, iv: string, d: string}>} - base64-encoded payload
 */
async function encryptPatientData(patient) {
  // 1. Генерируем случайный AES-256 ключ
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt'],
  );

  // 2. Шифруем данные пациента через AES-256-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(patient));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded,
  );

  // 3. Экспортируем AES-ключ и шифруем его публичным RSA-ключом
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const publicKey = await importPublicKey(PATIENT_DATA_PUBLIC_KEY_PEM);
  const encryptedAesKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawAesKey,
  );

  // 4. Кодируем в base64
  const toBase64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  return {
    k: toBase64(encryptedAesKey),
    iv: toBase64(iv),
    d: toBase64(encrypted),
  };
}
