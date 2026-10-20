import { describe, expect, it } from 'vitest'
import { invoiceInputSchema, paymentInputSchema } from '../financial-repositories'

describe('financial input validation',()=>{
 it('requires positive paise and ordered invoice periods',()=>{
  const valid={tenant_id:'11111111-1111-4111-8111-111111111111',description:'Rent',period_start:'2026-01-01',period_end:'2026-01-31',due_date:'2026-02-05',amount_paise:10000,source:'manual' as const}
  expect(invoiceInputSchema.safeParse(valid).success).toBe(true)
  expect(invoiceInputSchema.safeParse({...valid,amount_paise:0}).success).toBe(false)
  expect(invoiceInputSchema.safeParse({...valid,period_end:'2025-12-31'}).success).toBe(false)
 })
 it('requires positive allocation amounts and idempotency key',()=>{
  const valid={tenant_id:'11111111-1111-4111-8111-111111111111',amount_paise:1000,received_at:'2026-10-20T10:00:00.000Z',method:'UPI' as const,idempotency_key:'22222222-2222-4222-8222-222222222222',allocations:[{invoice_id:'33333333-3333-4333-8333-333333333333',amount_paise:1000}]}
  expect(paymentInputSchema.safeParse(valid).success).toBe(true)
  expect(paymentInputSchema.safeParse({...valid,allocations:[{...valid.allocations[0],amount_paise:-1}]}).success).toBe(false)
  expect(paymentInputSchema.safeParse({...valid,idempotency_key:'bad'}).success).toBe(false)
 })
})

import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import { createFinancialRepository } from '../financial-repositories'
import { RepositoryError } from '../repositories'

describe('financial repository RPC boundary',()=>{
 const workspace='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 const input={tenant_id:'11111111-1111-4111-8111-111111111111',description:'Rent',period_start:'2026-01-01',period_end:'2026-01-31',due_date:'2026-02-05',amount_paise:10000,source:'manual' as const}
 it('sends invoice creation to the atomic server function with workspace scope',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:{id:'invoice-id'},error:null})
  const client={rpc} as unknown as SupabaseClient<Database>
  await createFinancialRepository(client).createInvoice(workspace,input)
  expect(rpc).toHaveBeenCalledWith('create_rent_invoice',expect.objectContaining({p_workspace_id:workspace,p_tenant_id:input.tenant_id,p_amount_paise:10000}))
 })
 it('surfaces server permission and constraint failures',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:null,error:{message:'Not authorized to create invoices'}})
  const client={rpc} as unknown as SupabaseClient<Database>
  await expect(createFinancialRepository(client).createInvoice(workspace,input)).rejects.toBeInstanceOf(RepositoryError)
 })
})
