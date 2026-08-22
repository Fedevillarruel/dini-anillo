import { supabase } from './supabase'

function localDate(daysAgo = 0) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

function resultOrThrow(results) {
  const failed = results.find(({ error }) => error)
  if (failed) throw failed.error
}

export async function loadHealthDashboard(userId) {
  if (!supabase || !userId) return null

  const results = await Promise.all([
    supabase.from('rings').select('*').order('paired_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('health_measurements').select('*').gte('measured_at', `${localDate(7)}T00:00:00`).order('measured_at', { ascending: false }),
    supabase.from('activity_daily').select('*').gte('recorded_on', localDate(6)).order('recorded_on', { ascending: true }),
    supabase.from('sleep_sessions').select('*').gte('sleep_date', localDate(6)).order('sleep_date', { ascending: false }),
    supabase.from('device_settings').select('*').maybeSingle(),
  ])

  resultOrThrow(results)
  return {
    ring: results[0].data,
    measurements: results[1].data ?? [],
    activity: results[2].data ?? [],
    sleep: results[3].data ?? [],
    settings: results[4].data,
  }
}

export async function saveDeviceSettings(userId, changes) {
  if (!supabase) throw new Error('Supabase no está configurado.')

  const { error } = await supabase.from('device_settings').upsert(
    { user_id: userId, ...changes },
    { onConflict: 'user_id' },
  )

  if (error) throw error
}