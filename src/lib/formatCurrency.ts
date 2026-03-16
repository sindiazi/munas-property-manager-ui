/**
 * Formats a monetary amount using the browser's Intl API.
 * Falls back gracefully if the currency code is invalid.
 */
export function formatCurrency(
  amount: number | undefined | null,
  currencyCode: string = 'USD',
): string {
  if (amount == null) return '—'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Invalid currency code — fall back to plain number with code prefix
    return `${currencyCode} ${amount.toLocaleString()}`
  }
}
