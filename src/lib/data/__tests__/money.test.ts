import { describe, expect, it } from 'vitest'
import { formatINR, paiseToRupees, rupeesToPaise } from '../money'

describe('INR money boundary',()=>{
 it('converts rupees to exact integer paise',()=>{expect(rupeesToPaise('0.01')).toBe(1);expect(rupeesToPaise('12.30')).toBe(1230);expect(rupeesToPaise('12500')).toBe(1250000)})
 it('rejects negative, zero, excess precision and unsafe values',()=>{expect(()=>rupeesToPaise('-1')).toThrow();expect(()=>rupeesToPaise('0')).toThrow();expect(()=>rupeesToPaise('1.001')).toThrow();expect(()=>rupeesToPaise('999999999999999999')).toThrow()})
 it('renders a fixed two-decimal rupee string',()=>{expect(paiseToRupees(123)).toBe('1.23');expect(formatINR(1)).toContain('0.01')})
})
