import { Capacitor } from '@capacitor/core'
import { BleClient, ScanMode } from '@capacitor-community/bluetooth-le'

let initialized = false

export function isNativeBleAvailable() {
  return Capacitor.isNativePlatform()
}

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

  // Do not filter by UUID or advertised name: Lefun-family rings often expose
  // proprietary services and some advertise without a stable name.
  const device = await BleClient.requestDevice({
    displayMode: 'list',
    scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
    allowExtendedAdvertising: true,
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