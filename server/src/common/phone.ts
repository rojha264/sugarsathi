/** E.164 for Indian numbers: "98765 43210" or "098765..." becomes "+919876543210"; other numbers keep their country code. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}
