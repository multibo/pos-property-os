import { z } from 'zod'
const required = (label: string, max=160) => z.string().trim().min(1, `${label} is required`).max(max)
export const propertySchema = z.object({
 name: required('Property name'), address: required('Address',500),
 property_type: z.enum(['Apartment','House','Condo','Multi-family','Commercial','Other']),
 unit_count: z.coerce.number().int().positive('Unit count must be positive'),
 status: z.enum(['Active','Inactive']), notes: z.string().trim().max(5000).optional().nullable(),
})
export const tenantSchema = z.object({
 name: required('Name'), email: z.string().trim().email('Enter a valid email').max(254),
 phone: required('Phone',40), property_id: z.string().uuid('Choose a property'),
 unit_identifier: z.string().trim().max(80), lease_start: z.string().date(), lease_end: z.string().date(),
 monthly_rent: z.coerce.number().finite().min(0,'Rent cannot be negative'),
}).refine(v => v.lease_end >= v.lease_start, {path:['lease_end'],message:'Lease end must be on or after lease start'})
export const maintenanceSchema = z.object({
 title: required('Title',200), description: required('Description',5000),
 property_id: z.string().uuid('Choose a property'), tenant_id: z.string().uuid().nullable().optional(),
 priority: z.enum(['Low','Normal','High','Urgent']), status: z.enum(['Open','In Progress','Resolved']),
 created_date: z.string().date(),
})
export type PropertyInput = z.infer<typeof propertySchema>
export type TenantInput = z.infer<typeof tenantSchema>
export type MaintenanceInput = z.infer<typeof maintenanceSchema>
