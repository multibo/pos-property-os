/** Minimal generated-style schema types for the initial migration. Regenerate with Supabase CLI as schema evolves. */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; created_at: string; updated_at: string }
        Insert: { id: string; display_name?: string | null; created_at?: string; updated_at?: string }
        Update: { display_name?: string | null; updated_at?: string }
        Relationships: []
      }
      workspaces: {
        Row: { id: string; name: string; owner_id: string; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; owner_id?: string; created_at?: string; updated_at?: string }
        Update: { name?: string; updated_at?: string }
        Relationships: []
      }
      workspace_memberships: {
        Row: { workspace_id: string; user_id: string; role: 'owner' | 'admin' | 'member' | 'viewer'; created_at: string }
        Insert: { workspace_id: string; user_id: string; role?: 'owner' | 'admin' | 'member' | 'viewer'; created_at?: string }
        Update: { role?: 'owner' | 'admin' | 'member' | 'viewer' }
        Relationships: []
      }
      properties: {
        Row: { id:string; workspace_id:string; name:string; address:string; property_type:'Apartment'|'House'|'Condo'|'Multi-family'|'Commercial'|'Other'; unit_count:number; status:'Active'|'Inactive'; notes:string|null; created_at:string; updated_at:string }
        Insert: { id?:string; workspace_id:string; name:string; address:string; property_type:'Apartment'|'House'|'Condo'|'Multi-family'|'Commercial'|'Other'; unit_count:number; status?:'Active'|'Inactive'; notes?:string|null; created_at?:string; updated_at?:string }
        Update: { name?:string; address?:string; property_type?:'Apartment'|'House'|'Condo'|'Multi-family'|'Commercial'|'Other'; unit_count?:number; status?:'Active'|'Inactive'; notes?:string|null; updated_at?:string }
        Relationships: []
      }
      tenants: {
        Row: { id:string; workspace_id:string; property_id:string; name:string; email:string; phone:string; unit_identifier:string; lease_start:string; lease_end:string; monthly_rent:number; created_at:string; updated_at:string }
        Insert: { id?:string; workspace_id:string; property_id:string; name:string; email:string; phone:string; unit_identifier:string; lease_start:string; lease_end:string; monthly_rent:number; created_at?:string; updated_at?:string }
        Update: { property_id?:string; name?:string; email?:string; phone?:string; unit_identifier?:string; lease_start?:string; lease_end?:string; monthly_rent?:number; updated_at?:string }
        Relationships: [{ foreignKeyName: 'tenants_property_workspace_fk'; columns: ['workspace_id', 'property_id']; isOneToOne: false; referencedRelation: 'properties'; referencedColumns: ['workspace_id', 'id'] }]
      }
      rent_invoices: {
        Row: { id:string; workspace_id:string; tenant_id:string; property_id:string; invoice_number:string; source:'manual'|'rent_charge'; description:string; period_start:string; period_end:string; due_date:string; amount_paise:number; voided_at:string|null; void_reason:string|null; created_by:string; created_at:string }
        Insert: { id?:string; workspace_id:string; tenant_id:string; property_id:string; invoice_number:string; source?:'manual'|'rent_charge'; description:string; period_start:string; period_end:string; due_date:string; amount_paise:number; voided_at?:string|null; void_reason?:string|null; created_by?:string; created_at?:string }
        Update: { voided_at?:string|null; void_reason?:string|null }
        Relationships: [{ foreignKeyName:'rent_invoices_workspace_id_fkey'; columns:['workspace_id']; isOneToOne:false; referencedRelation:'workspaces'; referencedColumns:['id'] }, { foreignKeyName:'rent_invoices_property_workspace_fk'; columns:['workspace_id','property_id']; isOneToOne:false; referencedRelation:'properties'; referencedColumns:['workspace_id','id'] }, { foreignKeyName:'rent_invoices_workspace_property_tenant_fk'; columns:['workspace_id','property_id','tenant_id']; isOneToOne:false; referencedRelation:'tenants'; referencedColumns:['workspace_id','property_id','id'] }]
      }
      payments: {
        Row: { id:string; workspace_id:string; tenant_id:string; receipt_number:string; idempotency_key:string; amount_paise:number; received_at:string; method:'Cash'|'Bank transfer'|'Cheque'|'UPI'|'Other'; reference:string|null; notes:string|null; voided_at:string|null; void_reason:string|null; created_by:string; created_at:string }
        Insert: { id?:string; workspace_id:string; tenant_id:string; receipt_number:string; idempotency_key:string; amount_paise:number; received_at?:string; method?:'Cash'|'Bank transfer'|'Cheque'|'UPI'|'Other'; reference?:string|null; notes?:string|null; voided_at?:string|null; void_reason?:string|null; created_by?:string; created_at?:string }
        Update: { voided_at?:string|null; void_reason?:string|null }
        Relationships: [{ foreignKeyName:'payments_workspace_id_fkey'; columns:['workspace_id']; isOneToOne:false; referencedRelation:'workspaces'; referencedColumns:['id'] }, { foreignKeyName:'payments_tenant_workspace_fk'; columns:['workspace_id','tenant_id']; isOneToOne:false; referencedRelation:'tenants'; referencedColumns:['workspace_id','id'] }]
      }
      payment_allocations: {
        Row: { id:string; workspace_id:string; tenant_id:string; payment_id:string; invoice_id:string; amount_paise:number; created_at:string }
        Insert: { id?:string; workspace_id:string; tenant_id:string; payment_id:string; invoice_id:string; amount_paise:number; created_at?:string }
        Update: never
        Relationships: [{ foreignKeyName:'payment_allocations_workspace_id_fkey'; columns:['workspace_id']; isOneToOne:false; referencedRelation:'workspaces'; referencedColumns:['id'] }, { foreignKeyName:'allocations_payment_tenant_fk'; columns:['workspace_id','tenant_id','payment_id']; isOneToOne:false; referencedRelation:'payments'; referencedColumns:['workspace_id','tenant_id','id'] }, { foreignKeyName:'allocations_invoice_tenant_fk'; columns:['workspace_id','tenant_id','invoice_id']; isOneToOne:false; referencedRelation:'rent_invoices'; referencedColumns:['workspace_id','tenant_id','id'] }]
      }
      financial_ledger: {
        Row: { id:string; workspace_id:string; transaction_id:string; transaction_type:'invoice'|'payment'|'payment_void'|'invoice_void'; account_code:'accounts_receivable'|'rent_income'|'cash'|'unapplied_receipts'; transaction_date:string; description:string; reference:string|null; debit_paise:number; credit_paise:number; created_by:string; created_at:string }
        Insert: { id?:string; workspace_id:string; transaction_id:string; transaction_type:'invoice'|'payment'|'payment_void'|'invoice_void'; account_code:'accounts_receivable'|'rent_income'|'cash'|'unapplied_receipts'; transaction_date?:string; description:string; reference?:string|null; debit_paise?:number; credit_paise?:number; created_by?:string; created_at?:string }
        Update: never
        Relationships: [{ foreignKeyName:'financial_ledger_workspace_id_fkey'; columns:['workspace_id']; isOneToOne:false; referencedRelation:'workspaces'; referencedColumns:['id'] }]
      }
      maintenance_requests: {
        Row: { id:string; workspace_id:string; property_id:string; tenant_id:string|null; title:string; description:string; priority:'Low'|'Normal'|'High'|'Urgent'; status:'Open'|'In Progress'|'Resolved'; created_date:string; created_at:string; updated_at:string }
        Insert: { id?:string; workspace_id:string; property_id:string; tenant_id?:string|null; title:string; description:string; priority?:'Low'|'Normal'|'High'|'Urgent'; status?:'Open'|'In Progress'|'Resolved'; created_date?:string; created_at?:string; updated_at?:string }
        Update: { property_id?:string; tenant_id?:string|null; title?:string; description?:string; priority?:'Low'|'Normal'|'High'|'Urgent'; status?:'Open'|'In Progress'|'Resolved'; created_date?:string; updated_at?:string }
        Relationships: [
          { foreignKeyName: 'maintenance_property_workspace_fk'; columns: ['workspace_id', 'property_id']; isOneToOne: false; referencedRelation: 'properties'; referencedColumns: ['workspace_id', 'id'] },
          { foreignKeyName: 'maintenance_tenant_workspace_fk'; columns: ['workspace_id', 'tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['workspace_id', 'id'] },
          { foreignKeyName: 'maintenance_tenant_same_property_fk'; columns: ['workspace_id', 'property_id', 'tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['workspace_id', 'property_id', 'id'] }
        ]
      }
    }
    Views: { rent_invoice_balances: { Row: { id:string; workspace_id:string; tenant_id:string; property_id:string; invoice_number:string; source:'manual'|'rent_charge'; description:string; period_start:string; period_end:string; due_date:string; amount_paise:number; paid_paise:number; outstanding_paise:number; status:'void'|'paid'|'partially_paid'|'overdue'|'unpaid'; created_at:string; voided_at:string|null }; Relationships: [] } }
    Functions: {
      create_rent_invoice: { Args: { p_workspace_id:string; p_tenant_id:string; p_description:string; p_period_start:string; p_period_end:string; p_due_date:string; p_amount_paise:number; p_source?:'manual'|'rent_charge' }; Returns: Database['public']['Tables']['rent_invoices']['Row'] }
      record_rent_payment: { Args: { p_workspace_id:string; p_tenant_id:string; p_amount_paise:number; p_received_at:string; p_method:'Cash'|'Bank transfer'|'Cheque'|'UPI'|'Other'; p_reference:string|null; p_notes:string|null; p_idempotency_key:string; p_allocations:Json }; Returns: Database['public']['Tables']['payments']['Row'] }
      void_rent_payment: { Args: { p_workspace_id:string; p_payment_id:string; p_reason:string }; Returns: undefined }
      void_rent_invoice: { Args: { p_workspace_id:string; p_invoice_id:string; p_reason:string }; Returns: undefined }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type WorkspaceMembership = Database['public']['Tables']['workspace_memberships']['Row']
