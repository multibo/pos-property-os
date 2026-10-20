import { describe,it,expect } from 'vitest'
import { propertySchema,tenantSchema,maintenanceSchema } from '../schemas'
const property={name:'Home',address:'12 Main St',property_type:'House',unit_count:1,status:'Active'}
describe('domain Zod validation',()=>{
 it('accepts valid property and rejects nonpositive units',()=>{expect(propertySchema.safeParse(property).success).toBe(true);expect(propertySchema.safeParse({...property,unit_count:0}).success).toBe(false)})
 it('validates email, lease ordering, and nonnegative rent',()=>{const valid={name:'Tenant',email:'a@example.com',phone:'123',property_id:'10000000-0000-4000-8000-000000000001',unit_identifier:'A',lease_start:'2026-01-01',lease_end:'2026-12-31',monthly_rent:100};expect(tenantSchema.safeParse(valid).success).toBe(true);expect(tenantSchema.safeParse({...valid,email:'bad'}).success).toBe(false);expect(tenantSchema.safeParse({...valid,lease_end:'2025-01-01'}).success).toBe(false);expect(tenantSchema.safeParse({...valid,monthly_rent:-1}).success).toBe(false)})
 it('restricts maintenance enums and requires relationships',()=>{const valid={title:'Leak',description:'Kitchen sink leaking',property_id:'10000000-0000-4000-8000-000000000001',tenant_id:null,priority:'Urgent',status:'In Progress',created_date:'2026-10-20'};expect(maintenanceSchema.safeParse(valid).success).toBe(true);expect(maintenanceSchema.safeParse({...valid,status:'Closed'}).success).toBe(false)})
})
