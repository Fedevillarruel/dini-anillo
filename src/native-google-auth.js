import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'
import { supabase } from './supabase'

const googleWebClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || '200798723359-0dea9eb7r6ne1tojik767bfc1kci9lrp.apps.googleusercontent.com'

let initialized = false

export function canUseNativeGoogleSignIn() {
  return Capacitor.getPlatform() === 'android'
}

export async function signInWithNativeGoogle() {
  if (!supabase) throw new Error('Supabase no está configurado.')

  if (!initialized) {
    await SocialLogin.initialize({
      google: {
        webClientId: googleWebClientId,
        mode: 'online',
      },
    })
    initialized = true
  }

  const response = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: ['email', 'profile'],
    },
  })
  const idToken = response.result.idToken

  if (!idToken) throw new Error('Google no devolvió un token de identidad.')

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  })

  if (error) throw error
  return data.session
}