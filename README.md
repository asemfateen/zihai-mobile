# 字海 (Zihai) Mobile 📱

> A fast, modern Chinese-English dictionary mobile application built with React Native and Expo SDK 58, featuring offline SQLite search, stroke-order inspection, HSK levels, and native audio pronunciation.

---

## ✨ Features

- **Blazing Fast Offline Search:** Pre-bundled 15.75MB SQLite database powered by `expo-sqlite` for sub-5ms lookups with zero network required.
- **Deep Component & Stroke Breakdown:** Inspect compound words, sub-characters, radicals, and stroke counts interactively.
- **Tone-Stripped & Pinyin Search:** Supports Hanzi, accented pinyin, numbered pinyin, and English definition queries.
- **Audio Pronunciation:** Instant text-to-speech pronunciation for single characters and compound vocabulary.
- **HSK Tagging:** HSK level classification (HSK 1-6) across search results.
- **Modern Dark UI:** Edge-to-edge dark immersive display, custom gradient branding, and responsive layout.

---

## 🏗️ Project Structure

```
zihai-mobile/
├── mobile/                  # React Native / Expo SDK 58 mobile application
│   ├── assets/              # Offline SQLite database (zihai.db), brand icons, splash screens
│   ├── src/                 # Expo Router application screens & components
│   │   ├── app/             # Application routes (SearchScreen, CharacterModal, etc.)
│   │   └── components/      # UI components (ZihaiLogo, Icons, etc.)
│   ├── android/             # Native Android project (Gradle 9.4.1, CMake C++ TurboModules)
│   └── scripts/             # Asset generation & validation scripts
├── backend/                 # Node.js / Express dictionary API & data seeding tools
└── archive/                 # Archived legacy screen references
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Expo CLI](https://docs.expo.dev/)
- Android Studio / SDK (for local native Android builds)

### Running the Mobile App

1. Navigate to the `mobile` directory:
   ```bash
   cd mobile
   npm install
   ```

2. Start the Expo development server:
   ```bash
   npx expo start
   ```

3. Scan the QR code with **Expo Go** or run on an emulator/connected device:
   ```bash
   npx expo run:android
   ```

### Building Release Binaries

To build production signed Android binaries (`.apk` and `.aab`):

```bash
cd mobile/android
./gradlew assembleRelease bundleRelease
```

The output binaries will be generated in `mobile/android/app/build/outputs/`.

---

## 📄 License

Private & Proprietary. All rights reserved.
