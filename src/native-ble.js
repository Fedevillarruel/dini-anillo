import { Capacitor } from '@capacitor/core'
import { BleClient, ScanMode } from '@capacitor-community/bluetooth-le'
import { Device } from '@capacitor/device'

let initialized = false

function isBluetoothUuid(uuid, shortUuid) {
  const normalized = uuid.replaceAll('-', '').toLowerCase()
  return normalized === shortUuid || normalized === `0000${shortUuid}00001000800000805f9b34fb`
}

function dataViewToHex(value) {
  return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ')
}

export function isNativeBleAvailable() {
  return Capacitor.isNativePlatform()
}

export async function requestBlePermissions() {
  if (!Capacitor.isNativePlatform()) return

  const deviceInfo = await Device.getInfo()
  const usesNearbyDevicesPermission = Capacitor.getPlatform() === 'android'
    && (deviceInfo.androidSDKVersion ?? 0) >= 31

  if (!initialized) {
    await BleClient.initialize({ androidNeverForLocation: usesNearbyDevicesPermission })
    initialized = true
  }
}

async function prepareBle() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('La inspección Bluetooth se ejecuta desde la app Android o iPhone.')
  }

  const deviceInfo = await Device.getInfo()
  if (deviceInfo.isVirtual) {
    throw new Error('El emulador no puede detectar anillos Bluetooth físicos. Instala Dini Ring.apk en un teléfono Android real o ejecútala desde Xcode en un iPhone físico.')
  }

  const usesNearbyDevicesPermission = Capacitor.getPlatform() === 'android'
    && (deviceInfo.androidSDKVersion ?? 0) >= 31

  await requestBlePermissions()

  if (!(await BleClient.isEnabled())) {
    if (Capacitor.getPlatform() === 'android') {
      await BleClient.requestEnable()
    } else {
      throw new Error('Activa Bluetooth para Dini Ring desde Ajustes del iPhone.')
    }
  }

  if (Capacitor.getPlatform() === 'android' && !usesNearbyDevicesPermission && !(await BleClient.isLocationEnabled())) {
    throw new Error('Activa Ubicación del teléfono para buscar dispositivos Bluetooth cercanos y vuelve a intentar.')
  }

  return deviceInfo
}

export async function scanForBleDevices(onResult, duration = 20000) {
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
    const batteryService = services.find((service) => isBluetoothUuid(service.uuid, '180f'))
    const batteryCharacteristic = batteryService?.characteristics.find((characteristic) => isBluetoothUuid(characteristic.uuid, '2a19'))
    let batteryLevel = null

    if (batteryService && batteryCharacteristic?.properties.read) {
      try {
        const value = await BleClient.read(device.deviceId, batteryService.uuid, batteryCharacteristic.uuid)
        batteryLevel = value.getUint8(0)
      } catch {
        // Some Lefun firmware exposes a proprietary battery characteristic instead.
      }
    }

    const serviceProfiles = []

    for (const service of services) {
      const characteristics = []
      for (const characteristic of service.characteristics) {
        let valueHex = null
        if (characteristic.properties.read) {
          try {
            const value = await BleClient.read(device.deviceId, service.uuid, characteristic.uuid)
            valueHex = dataViewToHex(value)
          } catch {
            // Characteristic can require bonding or a proprietary command before reading.
          }
        }
        characteristics.push({
          uuid: characteristic.uuid,
          notify: characteristic.properties.notify,
          indicate: characteristic.properties.indicate,
          read: characteristic.properties.read,
          write: characteristic.properties.write,
          value_hex: valueHex,
        })
      }
      serviceProfiles.push({ uuid: service.uuid, characteristics })
    }

    return {
      device_id: device.deviceId,
      name: device.name || null,
      rssi,
      battery_level: batteryLevel,
      observed_at: new Date().toISOString(),
      services: serviceProfiles,
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