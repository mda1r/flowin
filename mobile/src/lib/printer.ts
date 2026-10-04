import { BleManager, type Device } from 'react-native-ble-plx'
import { Platform, PermissionsAndroid } from 'react-native'
import * as SecureStore from 'expo-secure-store'

let _manager: BleManager | null = null
function getManager(): BleManager {
  if (!_manager) _manager = new BleManager()
  return _manager
}

// Common ESC/POS thermal printer service/characteristic UUIDs
const PRINTER_SERVICE = '000018f0-0000-1000-8000-00805f9b34fb'
const PRINTER_CHAR = '00002af1-0000-1000-8000-00805f9b34fb'

let connectedDevice: Device | null = null

export interface PrinterDevice {
  id: string
  name: string
}

export async function getPrinterName(): Promise<string | null> {
  return SecureStore.getItemAsync('nexuspos_printer_name')
}

/** Scan for BLE devices and return list; pass a device to connect to it. */
export async function scanAndConnect(device: PrinterDevice | null): Promise<PrinterDevice[]> {
  if (device) {
    // Connect to specific device
    if (connectedDevice?.id === device.id) return []
    const d = await getManager().connectToDevice(device.id)
    await d.discoverAllServicesAndCharacteristics()
    connectedDevice = d
    return []
  }
  // Scan mode — return discovered devices
  const found: PrinterDevice[] = []
  return new Promise((resolve, reject) => {
    getManager().startDeviceScan(null, null, (error, d) => {
      if (error) { reject(error); return }
      if (d?.name && !found.find((f) => f.id === d.id)) {
        found.push({ id: d.id, name: d.name })
      }
    })
    setTimeout(() => {
      getManager().stopDeviceScan()
      resolve(found)
    }, 8000)
  })
}

export async function disconnect(): Promise<void> {
  connectedDevice?.cancelConnection()
  connectedDevice = null
}

export async function scanForPrinters(
  onDevice: (device: Device) => void,
  timeoutMs = 8000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    getManager().startDeviceScan(null, null, (error, device) => {
      if (error) { reject(error); return }
      if (device?.name) onDevice(device)
    })
    setTimeout(() => { getManager().stopDeviceScan(); resolve() }, timeoutMs)
  })
}

export async function connectPrinter(deviceId: string): Promise<void> {
  if (connectedDevice?.id === deviceId) return
  const device = await getManager().connectToDevice(deviceId)
  await device.discoverAllServicesAndCharacteristics()
  connectedDevice = device
}

export function disconnectPrinter() {
  connectedDevice?.cancelConnection()
  connectedDevice = null
}

export async function printReceipt(receipt: ReceiptData): Promise<void> {
  const bytes = buildEscPos(receipt)
  const base64 = Buffer.from(bytes).toString('base64')

  if (!connectedDevice) throw new Error('No printer connected')
  await connectedDevice.writeCharacteristicWithResponseForService(
    PRINTER_SERVICE,
    PRINTER_CHAR,
    base64,
  )
}

export interface ReceiptData {
  storeName: string
  branchName?: string
  orderId: string
  date: string
  lines: Array<{ name: string; qty: number; price: number }>
  subtotal: number
  tax: number
  total: number
  paymentMethod: string
  amountTendered?: number
  changeDue?: number
}

function buildEscPos(r: ReceiptData): Uint8Array {
  const ESC = 0x1b
  const GS = 0x1d
  const LF = 0x0a

  const enc = new TextEncoder()
  const chunks: number[] = []

  const push = (...bytes: number[]) => chunks.push(...bytes)
  const text = (s: string) => chunks.push(...Array.from(enc.encode(s)))
  const line = (s = '') => { text(s); push(LF) }
  const center = () => push(ESC, 0x61, 0x01)
  const left = () => push(ESC, 0x61, 0x00)
  const bold = (on: boolean) => push(ESC, 0x45, on ? 1 : 0)
  const cut = () => push(GS, 0x56, 0x00)

  // Init
  push(ESC, 0x40)

  center()
  bold(true)
  line(r.storeName)
  bold(false)
  if (r.branchName) line(r.branchName)
  line('─'.repeat(32))
  left()
  line(`Date: ${r.date}`)
  line(`Order: #${r.orderId.slice(-8).toUpperCase()}`)
  line('─'.repeat(32))

  for (const l of r.lines) {
    const priceStr = `${l.price.toFixed(2)}`
    const qtyName = `${l.qty}x ${l.name}`
    const padding = 32 - qtyName.length - priceStr.length
    text(qtyName)
    text(' '.repeat(Math.max(1, padding)))
    line(priceStr)
  }

  line('─'.repeat(32))
  const subtotalStr = `${r.subtotal.toFixed(2)}`
  const subLabel = 'Subtotal:'
  text(subLabel + ' '.repeat(32 - subLabel.length - subtotalStr.length))
  line(subtotalStr)

  const taxStr = `${r.tax.toFixed(2)}`
  const taxLabel = 'VAT (15%):'
  text(taxLabel + ' '.repeat(32 - taxLabel.length - taxStr.length))
  line(taxStr)

  bold(true)
  const totalStr = `${r.total.toFixed(2)} SAR`
  const totalLabel = 'TOTAL:'
  text(totalLabel + ' '.repeat(32 - totalLabel.length - totalStr.length))
  line(totalStr)
  bold(false)
  line('─'.repeat(32))
  line(`Payment: ${r.paymentMethod}`)
  if (r.amountTendered != null) line(`Tendered: ${r.amountTendered.toFixed(2)} SAR`)
  if (r.changeDue != null && r.changeDue > 0) line(`Change: ${r.changeDue.toFixed(2)} SAR`)
  line()
  center()
  line('شكراً لزيارتكم')
  line()
  push(LF, LF, LF)
  cut()

  return new Uint8Array(chunks)
}

// iOS/Android permission helper
export async function requestBluetoothPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ])
    return Object.values(granted).every((s) => s === PermissionsAndroid.RESULTS.GRANTED)
  }
  return true
}
