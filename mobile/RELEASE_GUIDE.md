# 字海 (Zihai) Mobile - Google Play & App Store Release Guide

This guide walks you through publishing 字海 (Zihai) Mobile to the **Google Play Store** (and Apple App Store) in under 15 minutes.

---

## Step 1: Pre-Launch Automated Verification

Run the built-in pre-flight verification script to confirm everything is green:

```bash
cd mobile
npm run verify
```

Expected output:
```text
======================================================
[ALL CHECKS PASSED: 100% READY FOR STORE SUBMISSION]
======================================================
```

---

## Step 2: Generate the Production Android App Bundle (`.aab`)

We use **Expo Application Services (EAS)**, the official cloud build pipeline for Expo apps. This avoids needing Android Studio or complex SDK configurations on your Windows PC.

1. **Install EAS CLI and log in:**
   ```bash
   npm install -g eas-cli
   npx eas-cli login
   ```
   *(If you don't have an Expo account, create a free one at [expo.dev](https://expo.dev)).*

2. **Run the production build:**
   ```bash
   npx eas-cli build --platform android --profile production
   ```
   - When asked: *"Generate a new Android Keystore?"*, select **Yes**. EAS will automatically generate a cryptographically secure PKCS#12 upload keystore and store it in your encrypted Expo vault.
   - Expo Cloud will compile the project using Android SDK 35/36 with Hermes bytecode and bundle `assets/zihai.db`.
   - In 4–6 minutes, the terminal will display a download link for your production `.aab` file (e.g. `zihai-1.0.0.aab`). Download it to your computer.

---

## Step 3: Google Play Console Submission

1. Go to the [Google Play Console](https://play.google.com/console) and click **Create app**.
2. **App details:**
   - **App name:** `字海 Zihai - Chinese Dictionary`
   - **Default language:** English (United States)
   - **App or game:** App
   - **Free or paid:** Free
3. **Store Listing Copy (Pre-written in `store_assets/STORE_LISTING.md`):**
   - Copy **Short description** (76 characters) from [`store_assets/STORE_LISTING.md`](store_assets/STORE_LISTING.md).
   - Copy **Full description** from [`store_assets/STORE_LISTING.md`](store_assets/STORE_LISTING.md).
   - Upload App Icon: [`assets/images/icon.png`](assets/images/icon.png) (1024x1024).
4. **Privacy Policy (Pre-written in `PRIVACY_POLICY.md`):**
   - Under *Policy and programs > Privacy policy*, provide the URL to your hosted privacy policy (or upload [`public/privacy-policy.html`](public/privacy-policy.html) to your domain, GitHub Pages, or Vercel).
5. **Data Safety Questionnaire:**
   - Does your app collect or share user data? Select **No**.
   - (The app is 100% offline, zero network requests, zero analytics, zero ads).
6. **Upload the Binary:**
   - Navigate to **Production** (or **Closed testing**).
   - Create a new release and drag in the `.aab` file you downloaded from EAS in Step 2.
   - Paste the Release Notes from [`store_assets/STORE_LISTING.md`](store_assets/STORE_LISTING.md).
7. **Submit:**
   - Click **Review release** -> **Start rollout to Production**.

---

## File Reference Checklist

- [**`PRIVACY_POLICY.md`**](PRIVACY_POLICY.md) — Raw Markdown Privacy Policy.
- [**`public/privacy-policy.html`**](public/privacy-policy.html) — Hostable HTML Privacy Policy for Google Play URL requirement.
- [**`store_assets/STORE_LISTING.md`**](store_assets/STORE_LISTING.md) — Exact titles, short/full descriptions, and questionnaire answers.
- [**`scripts/verify-launch.js`**](scripts/verify-launch.js) — Pre-flight validator (`npm run verify`).
- [**`eas.json`**](eas.json) — Production build profile.
