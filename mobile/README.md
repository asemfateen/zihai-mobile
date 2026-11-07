# 字海 (Zihai Mobile)

Offline-first Chinese Dictionary powered by React Native, Expo, and local SQLite.

## System Requirements
- Node.js >= 18
- OpenJDK 17 or 21 (for local Android Gradle builds)
- Android SDK Platform 35 (`compileSdkVersion 35`, `targetSdkVersion 35`)

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm start
   ```

3. **Typecheck & Lint:**
   ```bash
   npm run typecheck
   npm run lint
   ```

## Production Android Releases

### Option A: Cloud Builds via Expo Application Services (EAS)
This repository includes a preconfigured `eas.json`.
```bash
# Build production Android App Bundle on EAS
npx eas-cli build --platform android --profile production
```

### Option B: Local Android Gradle Build
Ensure OpenJDK 17/21 and `ANDROID_HOME` are set in your environment.

1. **Provide your private release keystore:**
   Generate your secure upload key (keep it out of version control):
   ```bash
   keytool -genkeypair -v -keystore release.keystore -alias zihai-release-key -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Supply signing credentials via environment variables:**
   ```bash
   export ANDROID_KEYSTORE_PATH="/path/to/release.keystore"
   export ANDROID_KEYSTORE_PASSWORD="your-strong-password"
   export ANDROID_KEY_ALIAS="zihai-release-key"
   export ANDROID_KEY_PASSWORD="your-strong-password"
   ```

3. **Generate Production Bundle:**
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
   *(To test release compilation with debug keys locally, pass `-PALLOW_DEBUG_KEYSTORE_IN_RELEASE=true`)*

## Architecture Notes
- **Dictionary Database:** 15MB local SQLite (`assets/zihai.db`), zero runtime network requests.
- **Search Pipeline:** Debounced, whole-syllable Pinyin matching with polyphonic tone support and clean English definition extraction.
- **Audio TTS:** Local on-device speech engine (`expo-speech`).
