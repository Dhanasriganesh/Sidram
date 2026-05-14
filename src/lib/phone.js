/**
 * Compare mobiles in a forgiving way (+91… vs 10 digits, spaces, dashes).
 * Uses the last 10 digits when at least 10 digits are present (typical India mobile).
 */
export function normalizeMobileKey(input) {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (digits.length >= 10) return digits.slice(-10)
  return digits
}
