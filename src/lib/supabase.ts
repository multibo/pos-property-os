import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './data/database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes('YOUR_PROJECT_REF') && !anonKey.includes('YOUR_SUPABASE'),
)

/** Browser-safe client only. Never use a service-role key in this application. */
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null
