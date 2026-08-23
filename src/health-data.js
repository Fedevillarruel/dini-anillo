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

export async function loadProfile(userId) {
  if (!supabase || !userId) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('first_name, last_name, phone, full_name')
    .eq('id', userId)
    .maybeSingle()

  if (!error) return data

  const fallback = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle()

  if (fallback.error) throw error
  return fallback.data
}

export async function saveProfile(userId, profile) {
  if (!supabase) throw new Error('Supabase no está configurado.')

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  const { error } = await supabase.auth.updateUser({
    data: {
      first_name: profile.first_name || null,
      last_name: profile.last_name || null,
      full_name: fullName || null,
      phone: profile.phone || null,
    },
  })

  if (error) throw error
}

export async function saveRing(userId, ring) {
  if (!supabase) throw new Error('Supabase no está configurado.')

  const existing = await supabase
    .from('rings')
    .select('id, bluetooth_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing.error) throw existing.error
  if (existing.data && existing.data.bluetooth_id !== ring.bluetooth_id) {
    throw new Error('Esta cuenta ya tiene un Dini Ring vinculado.')
  }

  const { error } = await supabase.from('rings').upsert(
    { user_id: userId, ...ring },
    { onConflict: 'user_id,bluetooth_id' },
  )

  if (!error) return { colorSaved: true }

  if (!error.message?.includes("'color' column")) throw error

  const legacyRing = Object.fromEntries(
    Object.entries(ring).filter(([key]) => key !== 'color'),
  )
  const retry = await supabase.from('rings').upsert(
    { user_id: userId, ...legacyRing },
    { onConflict: 'user_id,bluetooth_id' },
  )

  if (retry.error) throw retry.error
  return { colorSaved: false }
}

export async function saveRingHardware(userId, hardware) {
  if (!supabase) throw new Error('Supabase no está configurado.')

  const { error } = await supabase
    .from('rings')
    .update({ hardware_profile: hardware, last_connected_at: hardware.observed_at })
    .eq('user_id', userId)

  if (!error) return

  if (!error.message?.includes("'hardware_profile' column")) throw error

  const fallback = await supabase
    .from('rings')
    .update({ last_connected_at: hardware.observed_at })
    .eq('user_id', userId)

  if (fallback.error) throw fallback.error
}

export async function unlinkRing(userId) {
  if (!supabase) throw new Error('Supabase no está configurado.')

  const { error } = await supabase
    .from('rings')
    .delete()
    .eq('user_id', userId)

  if (error) throw error
}

export function subscribeToHealthUpdates(userId, onChange, onStatus) {
  if (!supabase || !userId) return () => {}

  const filter = `user_id=eq.${userId}`
  const channel = supabase
    .channel(`dini-ring-health-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'health_measurements', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_daily', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sleep_sessions', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rings', filter }, onChange)
    .subscribe((status) => onStatus?.(status))

  return () => { supabase.removeChannel(channel) }
}