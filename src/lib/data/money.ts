import { z } from 'zod'

/** INR input boundary: accepts decimal rupees and converts to integer paise without binary-float rounding drift. */
export function rupeesToPaise(input: string | number): number {
  const raw = String(input).trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Enter an amount with at most two decimal places.')
  const [rupees, fraction = ''] = raw.split('.')
  const paise = Number(rupees) * 100 + Number((fraction + '00').slice(0, 2))
  if (!Number.isSafeInteger(paise) || paise <= 0) throw new Error('Amount must be positive and within the supported range.')
  return paise
}
export function paiseToRupees(paise: number): string {
  if (!Number.isSafeInteger(paise)) throw new Error('Paise must be a safe integer.')
  return (paise / 100).toFixed(2)
}
export function formatINR(paise: number): string {
  if (!Number.isSafeInteger(paise)) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paise / 100)
}
export const positivePaiseSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
