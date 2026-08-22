import { Capacitor } from '@capacitor/core'
import { BleClient, ScanMode } from '@capacitor-community/bluetooth-le'
import { Device } from '@capacitor/device'

let initialized = false

export function isNativeBleAvailable() {
  return Capacitor.isNativePlatform()
}

async function prepareBle() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('La inspección Bluetooth se ejecuta desde la app Android o iPhone.')
  }

  const deviceInfo = await Device.getInfo()
  if (deviceInfo.isVirtual) {
    throw new Error('El emulador no puede detectar anillos Bluetooth físicos. Instala Dini Ring.apk en un teléfono Android real o ejecútala desde Xcode en un iPhone físico.')
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

  return deviceInfo
}

export async function scanForBleDevices(onResult, duration = 12000) {
  await prepareBle()
  const devices = new Map()

  await BleClient.requestLEScan(
    {
      allowDuplicates: true,
      scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
      allowExtendedAdvertising: true,
    },
    (result) => {
      const device = {
        deviceId: result.device.deviceId,
        name: result.localName || result.device.name || '',
        rssi: result.rssi ?? null,
      }
      devices.set(device.deviceId, device)
      onResult?.([...devices.values()].sort((first, second) => (second.rssi ?? -999) - (first.rssi ?? -999)))
    },
  )

  try {
    await new Promise((resolve) => window.setTimeout(resolve, duration))
    return [...devices.values()].sort((first, second) => (second.rssi ?? -999) - (first.rssi ?? -999))
  } finally {
    await BleClient.stopLEScan().catch(() => {})
  }
}

export async function inspectRingDevice(device) {
  await prepareBle()

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

export async function inspectExistingRing() {
  await prepareBle()
  const device = await BleClient.requestDevice({
    displayMode: 'list',
    scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
    allowExtendedAdvertising: true,
  })
  return inspectRingDevice(device)
}