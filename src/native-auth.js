import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase } from './supabase'

const nativeRedirectUrl = 'com.heartring.app://auth/callback'

export function getAuthRedirectTo() {
  return Capacitor.isNativePlatform() ? nativeRedirectUrl : window.location.origin
}

export async function signInWithProvider(provider) {
  if (!supabase) return { error: new Error('Supabase no está configurado.') }

  const native = Capacitor.isNativePlatform()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getAuthRedirectTo(),
      skipBrowserRedirect: native,
    },
  })

  if (!error && native && data.url) await Browser.open({ url: data.url })
  return { error }
}

export function subscribeToNativeAuth(onSession, onError) {
  if (!Capacitor.isNativePlatform() || !supabase) return () => {}

  let listener
  App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(nativeRedirectUrl)) return
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(url)
      if (error) throw error
      await Browser.close()
      onSession(data.session)
    } catch (error) {
      onError(error.message)
    }
  }).then((handle) => { listener = handle })

  return () => listener?.remove()
}