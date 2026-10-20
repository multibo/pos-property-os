import { describe,it,expect,vi } from 'vitest'
import { createPropertyRepository } from '../domain-repositories'
import { RepositoryError } from '../repositories'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
function makeClient(result:{data:any;error:any}) {
 const query:any={select:vi.fn(),eq:vi.fn(),order:vi.fn(),insert:vi.fn(),update:vi.fn(),delete:vi.fn(),single:vi.fn(),maybeSingle:vi.fn()}
 for(const k of ['select','eq','order','insert','update','delete']) query[k].mockReturnValue(query)
 query.single.mockResolvedValue(result);query.maybeSingle.mockResolvedValue(result)
 const client={from:vi.fn().mockReturnValue(query)} as unknown as SupabaseClient<Database>
 return {client,query}
}
const row={id:'10000000-0000-4000-8000-000000000001',workspace_id:'20000000-0000-4000-8000-000000000002',name:'Home',address:'12 Main',property_type:'House',unit_count:1,status:'Active',notes:null,created_at:'2026-01-01',updated_at:'2026-01-01'}
describe('domain repository',()=>{
 it('creates a validated property and includes workspace scope',async()=>{const {client,query}=makeClient({data:row,error:null});const result=await createPropertyRepository(client).create(row.workspace_id,{name:'Home',address:'12 Main',property_type:'House',unit_count:1,status:'Active'});expect(result).toEqual(row);expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({workspace_id:row.workspace_id,name:'Home'}))})
 it('wraps backend errors rather than returning mock success',async()=>{const {client}=makeClient({data:null,error:{message:'RLS denied'}});await expect(createPropertyRepository(client).create(row.workspace_id,{name:'Home',address:'12 Main',property_type:'House',unit_count:1,status:'Active'})).rejects.toBeInstanceOf(RepositoryError)})
 it('rejects invalid input before any insert',async()=>{const {client,query}=makeClient({data:null,error:null});await expect(createPropertyRepository(client).create(row.workspace_id,{name:'',address:'',property_type:'House',unit_count:0,status:'Active'} as any)).rejects.toThrow();expect(query.insert).not.toHaveBeenCalled()})
})
