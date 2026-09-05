import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)
export const isLocalDemoMode = import.meta.env.VITE_DATA_MODE === 'local'
export const needsSupabaseConfiguration = !isLocalDemoMode && !isSupabaseConfigured

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

export const dataMode = !isLocalDemoMode && isSupabaseConfigured
  ? 'supabase'
  : 'local'
