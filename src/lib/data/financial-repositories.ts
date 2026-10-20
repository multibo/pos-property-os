import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { RepositoryError } from './repositories'
import { positivePaiseSchema } from './money'
import { z } from 'zod'

export const invoiceInputSchema = z.object({ tenant_id: z.string().uuid(), description: z.string().trim().min(1).max(500), period_start: z.string().date(), period_end: z.string().date(), due_date: z.string().date(), amount_paise: positivePaiseSchema, source: z.enum(['manual','rent_charge']).default('manual') }).refine(v => v.period_end >= v.period_start, { path: ['period_end'], message: 'Period end must be on or after period start.' })
export const paymentInputSchema = z.object({ tenant_id: z.string().uuid(), amount_paise: positivePaiseSchema, received_at: z.string().datetime(), method: z.enum(['Cash','Bank transfer','Cheque','UPI','Other']), reference: z.string().max(200).optional(), notes: z.string().max(1000).optional(), idempotency_key: z.string().uuid(), allocations: z.array(z.object({ invoice_id: z.string().uuid(), amount_paise: positivePaiseSchema })).max(100) })
export type InvoiceInput = z.input<typeof invoiceInputSchema>
export type PaymentInput = z.input<typeof paymentInputSchema>
export interface InvoiceBalance { id:string; workspace_id:string; tenant_id:string; property_id:string; invoice_number:string; source:'manual'|'rent_charge'; description:string; period_start:string; period_end:string; due_date:string; amount_paise:number; paid_paise:number; outstanding_paise:number; status:'void'|'paid'|'partially_paid'|'overdue'|'unpaid'; created_at:string; voided_at:string|null }
export interface PaymentRow { id:string; workspace_id:string; tenant_id:string; receipt_number:string; idempotency_key:string; amount_paise:number; received_at:string; method:string; reference:string|null; notes:string|null; voided_at:string|null; void_reason:string|null; created_at:string }
export interface AllocationRow { id:string; workspace_id:string; tenant_id:string; payment_id:string; invoice_id:string; amount_paise:number; created_at:string }
export interface LedgerRow { id:string; workspace_id:string; transaction_id:string; transaction_type:string; account_code:string; transaction_date:string; description:string; reference:string|null; debit_paise:number; credit_paise:number; created_at:string }
const fail = (message:string, error?:unknown):never => { throw new RepositoryError(message, { cause:error }) }
export function createFinancialRepository(client: SupabaseClient<Database>) {
 return {
  async invoices(workspaceId:string):Promise<InvoiceBalance[]> { const {data,error}=await client.from('rent_invoice_balances').select('*').eq('workspace_id',workspaceId).order('due_date',{ascending:false}); if(error) fail('Unable to load invoices.',error); return (data??[]) as InvoiceBalance[] },
  async payments(workspaceId:string):Promise<PaymentRow[]> { const {data,error}=await client.from('payments').select('*').eq('workspace_id',workspaceId).order('received_at',{ascending:false}); if(error) fail('Unable to load payments.',error); return (data??[]) as PaymentRow[] },
  async allocations(workspaceId:string):Promise<AllocationRow[]> { const {data,error}=await client.from('payment_allocations').select('*').eq('workspace_id',workspaceId); if(error) fail('Unable to load payment allocations.',error); return (data??[]) as AllocationRow[] },
  async ledger(workspaceId:string):Promise<LedgerRow[]> { const {data,error}=await client.from('financial_ledger').select('*').eq('workspace_id',workspaceId).order('transaction_date',{ascending:false}); if(error) fail('Unable to load the ledger.',error); return (data??[]) as LedgerRow[] },
  async properties(workspaceId:string) { const {data,error}=await client.from('properties').select('id,name').eq('workspace_id',workspaceId).order('name'); if(error) fail('Unable to load properties.',error); return data??[] },
  async tenants(workspaceId:string) { const {data,error}=await client.from('tenants').select('id,name,property_id,unit_identifier,monthly_rent').eq('workspace_id',workspaceId).order('name'); if(error) fail('Unable to load tenants.',error); return data??[] },
  async createInvoice(workspaceId:string, raw:InvoiceInput) { const v=invoiceInputSchema.parse(raw); const {data,error}=await client.rpc('create_rent_invoice',{p_workspace_id:workspaceId,p_tenant_id:v.tenant_id,p_description:v.description,p_period_start:v.period_start,p_period_end:v.period_end,p_due_date:v.due_date,p_amount_paise:v.amount_paise,p_source:v.source}); if(error||!data) fail(error?.message ?? 'Invoice was not created.',error); return data },
  async recordPayment(workspaceId:string, raw:PaymentInput) { const v=paymentInputSchema.parse(raw); const {data,error}=await client.rpc('record_rent_payment',{p_workspace_id:workspaceId,p_tenant_id:v.tenant_id,p_amount_paise:v.amount_paise,p_received_at:v.received_at,p_method:v.method,p_reference:v.reference??null,p_notes:v.notes??null,p_idempotency_key:v.idempotency_key,p_allocations:v.allocations}); if(error||!data) fail(error?.message ?? 'Payment was not recorded.',error); return data },
  async voidPayment(workspaceId:string,paymentId:string,reason:string) { if(reason.trim().length<3) throw new Error('Enter a reason of at least 3 characters.'); const {error}=await client.rpc('void_rent_payment',{p_workspace_id:workspaceId,p_payment_id:paymentId,p_reason:reason.trim()}); if(error) fail(error.message,error) },
  async voidInvoice(workspaceId:string,invoiceId:string,reason:string) { if(reason.trim().length<3) throw new Error('Enter a reason of at least 3 characters.'); const {error}=await client.rpc('void_rent_invoice',{p_workspace_id:workspaceId,p_invoice_id:invoiceId,p_reason:reason.trim()}); if(error) fail(error.message,error) },
 }
}
