import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Alec's Supabase (JARVIS + E1-E5)
const alecUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const alecKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Nathan's Supabase (P.I.K.E. + E6-E10)
const nateUrl = process.env.NEXT_PUBLIC_NATE_SUPABASE_URL || ''
const nateKey = process.env.NEXT_PUBLIC_NATE_SUPABASE_ANON_KEY || ''

export const alecSupabase: SupabaseClient | null = alecUrl && alecKey 
  ? createClient(alecUrl, alecKey) 
  : null

export const nateSupabase: SupabaseClient | null = nateUrl && nateKey 
  ? createClient(nateUrl, nateKey) 
  : null

// Combined data fetchers
export async function getAllEngineers() {
  const results = []
  
  // Fetch from Alec's Supabase (JARVIS team)
  if (alecSupabase) {
    const { data } = await alecSupabase
      .from('engineers')
      .select('*')
      .eq('manager', 'jarvis')
    if (data) results.push(...data.map(e => ({ ...e, team: 'alec' })))
  }
  
  // Fetch from Nathan's Supabase (P.I.K.E. team)
  if (nateSupabase) {
    const { data } = await nateSupabase
      .from('engineers')
      .select('*')
    if (data) results.push(...data.map(e => ({ ...e, team: 'nate' })))
  }
  
  return results
}

export async function getAllTasks() {
  const results = []
  
  if (alecSupabase) {
    const { data } = await alecSupabase.from('tasks').select('*')
    if (data) results.push(...data.map(t => ({ ...t, team: 'alec' })))
  }
  
  if (nateSupabase) {
    const { data } = await nateSupabase.from('tasks').select('*')
    if (data) results.push(...data.map(t => ({ ...t, team: 'nate' })))
  }
  
  return results
}

export async function getAllFeed() {
  const results = []
  
  if (alecSupabase) {
    const { data } = await alecSupabase
      .from('feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) results.push(...data.map(f => ({ ...f, team: 'alec' })))
  }
  
  if (nateSupabase) {
    const { data } = await nateSupabase
      .from('feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) results.push(...data.map(f => ({ ...f, team: 'nate' })))
  }
  
  // Sort combined results by created_at
  return results.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 50)
}

export async function getTaskCounts() {
  const counts = {
    alec: { queued: 0, in_progress: 0, completed: 0, blocked: 0 },
    nate: { queued: 0, in_progress: 0, completed: 0, blocked: 0 },
    total: { queued: 0, in_progress: 0, completed: 0, blocked: 0 }
  }
  
  const tasks = await getAllTasks()
  tasks.forEach(t => {
    const status = t.status as keyof typeof counts.total
    if (status in counts.total) {
      counts.total[status]++
      if (t.team === 'alec') counts.alec[status]++
      if (t.team === 'nate') counts.nate[status]++
    }
  })
  
  return counts
}

// Real-time subscriptions
export function subscribeToEngineers(callback: (engineers: any[]) => void) {
  const fetchAll = async () => callback(await getAllEngineers())
  
  // Initial fetch
  fetchAll()
  
  // Subscribe to both
  const subs: any[] = []
  
  if (alecSupabase) {
    subs.push(
      alecSupabase
        .channel('alec-engineers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'engineers' }, fetchAll)
        .subscribe()
    )
  }
  
  if (nateSupabase) {
    subs.push(
      nateSupabase
        .channel('nate-engineers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'engineers' }, fetchAll)
        .subscribe()
    )
  }
  
  // Return unsubscribe function
  return () => subs.forEach(s => s.unsubscribe())
}

export function subscribeToFeed(callback: (feed: any[]) => void) {
  const fetchAll = async () => callback(await getAllFeed())
  
  fetchAll()
  
  const subs: any[] = []
  
  if (alecSupabase) {
    subs.push(
      alecSupabase
        .channel('alec-feed')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feed' }, fetchAll)
        .subscribe()
    )
  }
  
  if (nateSupabase) {
    subs.push(
      nateSupabase
        .channel('nate-feed')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feed' }, fetchAll)
        .subscribe()
    )
  }
  
  return () => subs.forEach(s => s.unsubscribe())
}
