# NexusPOS Mobile — Setup Guide

## Prerequisites

- Node.js 20+
- Expo CLI: `npm i -g expo-cli eas-cli`
- For Android: Android Studio with emulator
- For iOS: Xcode 15+ (Mac only)

## Install & Run

```bash
cd mobile
npm install
```

### Development (Expo Go)

> Note: `react-native-ble-plx` requires a dev build (custom Expo Go won't work for BLE).

```bash
npx expo start
```

### Dev Build (recommended — includes BLE + Camera)

```bash
# Android emulator/device
eas build --profile development --platform android
npx expo start --dev-client

# iOS simulator
eas build --profile development --platform ios --local
npx expo start --dev-client
```

## Environment

Update the API URL in Settings → عنوان API after login,  
or pre-set it in `src/api/client.ts`:

```ts
const BASE_URL = 'https://your-railway-app.railway.app'
```

## Build for Production

```bash
# Android AAB (Play Store)
eas build --profile production --platform android

# iOS (App Store)
eas build --profile production --platform ios

# Submit
eas submit --platform android
eas submit --platform ios
```

## Features

| Screen | Feature |
|--------|---------|
| POS | Product grid, cart, barcode scan, offline queue, BLE receipt printer |
| Products | CRUD products + variants |
| Inventory | Stock levels, adjust in/out/set |
| Customers | CRUD customers, loyalty points |
| Reports | Daily/weekly/monthly sales summary, top products, shifts |
| Settings | Bluetooth printer, API URL, account/logout |

## Offline Support

- Products + categories cached in SQLite on every sync
- Orders queued locally when offline (`expo-sqlite`)  
- Auto-syncs when network returns (background NetInfo listener)

## Bluetooth Printing

- ESC/POS protocol over BLE GATT
- Go to Settings → فحص الطابعات to discover printers
- Tap a printer to connect; connection persists in `expo-secure-store`
