/**
 * Нормализует российский номер телефона к виду 79XXXXXXXXX (11 цифр).
 *
 * Поддерживает:
 *   - "+7 (999) 123-45-67"  → "79991234567"
 *   - "8 999 123-45-67"     → "79991234567"
 *   - "9991234567"          → "79991234567" (10 цифр без кода страны)
 *   - "79991234567"         → "79991234567"
 *
 * Возвращает null если число цифр не подходит или код страны не 7/8.
 */
export function normalizeRuPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, '');
  if (digits.length === 11) {
    if (digits.startsWith('7')) return digits;
    if (digits.startsWith('8')) return '7' + digits.slice(1);
    return null;
  }
  if (digits.length === 10) {
    // Номер без кода страны — добавляем 7
    return '7' + digits;
  }
  return null;
}
