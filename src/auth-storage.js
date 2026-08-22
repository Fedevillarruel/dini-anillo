import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const nativeSessionStorage = {
  async getItem(key) {
    const { value } = await Preferences.get({ key })
    if (value !== null) return value

    const legacyValue = window.localStorage.getItem(key)
    if (legacyValue !== null) await Preferences.set({ key, value: legacyValue })
    return legacyValue
  },

  async setItem(key, value) {
    await Preferences.set({ key, value })
  },

  async removeItem(key) {
    await Preferences.remove({ key })
    window.localStorage.removeItem(key)
  },
}

export const authStorage = Capacitor.isNativePlatform()
  ? nativeSessionStorage
  : window.localStorage