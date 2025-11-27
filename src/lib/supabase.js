import { createClient } from '@supabase/supabase-js'

export function initSupabase(state) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  state.supabaseClient = createClient(url, anon)
  return state.supabaseClient
}
