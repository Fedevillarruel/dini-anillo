import { Capacitor } from '@capacitor/core'
import { BleClient } from '@capacitor-community/bluetooth-le'

let initialized = false

const standardServices = ['180a', '180d', '1810', '1822', '180f']

export async function inspectExistingRing() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('La inspección Bluetooth se ejecuta desde la app Android o iPhone.')
  }

  if (!initialized) {
    await BleClient.initialize({ androidNeverForLocation: true })
    initialized = true
  }

  if (!(await BleClient.isEnabled())) {
    if (Capacitor.getPlatform() === 'android') {
      await BleClient.requestEnable()
    } else {
      throw new Error('Activa Bluetooth para Dini Ring desde Ajustes del iPhone.')
    }
  }

  const device = await BleClient.requestDevice({
    optionalServices: standardServices,
    displayMode: 'list',
  })

  await BleClient.connect(device.deviceId)
  try {
    const [services, rssi] = await Promise.all([
      BleClient.getServices(device.deviceId),
      BleClient.readRssi(device.deviceId),
    ])

    return {
      device_id: device.deviceId,
      name: device.name || null,
      rssi,
      observed_at: new Date().toISOString(),
      services: services.map((service) => ({
        uuid: service.uuid,
        characteristics: service.characteristics.map((characteristic) => ({
          uuid: characteristic.uuid,
          notify: characteristic.properties.notify,
          indicate: characteristic.properties.indicate,
          read: characteristic.properties.read,
          write: characteristic.properties.write,
        })),
      })),
    }
  } finally {
    await BleClient.disconnect(device.deviceId).catch(() => {})
  }
}