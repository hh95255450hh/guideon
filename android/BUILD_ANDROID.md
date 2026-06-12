# 📱 Building the Guideon Android app (TWA → Google Play)

Guideon ships as a **Trusted Web Activity (TWA)** — a thin Android wrapper
around the live PWA at https://guideon.om. The app shows the real site
full-screen with **no browser address bar**, because the site already serves
a verified Digital Asset Link.

Everything on the web side is done:
- ✅ `public/manifest.json` — complete (icons, shortcuts, theme, screenshots)
- ✅ `public/.well-known/assetlinks.json` — live at
  https://guideon.om/.well-known/assetlinks.json (200, application/json)
- ✅ `android/twa-manifest.json` — Bubblewrap config (this folder)

You just need a machine with the build tools to produce the signed package.

---

## Prerequisites (one-time)

1. **Node.js 18+** (you already have this).
2. **JDK 17** — https://adoptium.net (Temurin 17).
3. **Android SDK** — easiest via Android Studio, or Bubblewrap can download it.
4. Install Bubblewrap globally:
   ```bash
   npm install -g @bubblewrap/cli
   ```

---

## ⚠️ About the signing key (important)

`assetlinks.json` already contains this release fingerprint:

```
60:E9:36:37:C7:67:C7:C6:8D:70:F2:D5:54:E7:DA:00:00:32:54:9D:B2:50:F4:E3:62:A2:C0:AD:BF:61:F1:83
```

The app MUST be signed with the **same keystore** that produced that
fingerprint, or Android will keep showing the browser address bar.

- **If you still have that keystore** → put it at `android/android.keystore`
  with key alias `guideon` and build (below).
- **If you lost it** → generate a new one, then UPDATE the fingerprint in
  both `public/.well-known/assetlinks.json` and `android/twa-manifest.json`:
  ```bash
  keytool -genkey -v -keystore android/android.keystore \
    -alias guideon -keyalg RSA -keysize 2048 -validity 9125
  # then read its fingerprint:
  keytool -list -v -keystore android/android.keystore -alias guideon | grep SHA256
  ```
  Replace the old fingerprint with the new SHA-256 value in both files,
  redeploy the site (so the new assetlinks goes live), then build.

> 🔐 Keep `android.keystore` **safe and private** — it's already
> git-ignored. Losing it means you can never update the app on Play again.

---

## Build steps

From the `android/` folder:

```bash
cd android

# First time only — scaffolds the Android project from twa-manifest.json
bubblewrap init --manifest=https://guideon.om/manifest.json

# Build the signed app
bubblewrap build
```

Output:
- `app-release-signed.apk` — for sideloading / testing on a device
- `app-release-bundle.aab` — **this is what you upload to Google Play**

To test on a phone (USB debugging on):
```bash
bubblewrap install
```

---

## Publishing to Google Play

1. Go to https://play.google.com/console → pay the **one-time $25** developer
   fee. Register as an **Organization** and enter your **D-U-N-S 850403864**
   for **Vision for Digital Thought**.
2. Create app → upload `app-release-bundle.aab`.
3. Fill the store listing:
   - **App name:** Guideon
   - **Short description:** Find and book licensed tour guides across Oman.
   - **Privacy policy URL:** https://guideon.om/privacy.html
   - **Category:** Travel & Local
   - Screenshots: take a few from the live site on a phone.
4. **Data safety** form — declare: account data (name/email), bookings,
   messages. All encrypted in transit; no data sold. Link the privacy policy.
5. Submit for review (typically 1–7 days for a new org).

---

## Updating the app later

Bump `appVersionCode` (and optionally `appVersionName`) in
`android/twa-manifest.json`, then `bubblewrap build` again and upload the new
`.aab`. Because it's a TWA, **content changes on guideon.om appear instantly**
in the app with no rebuild — you only rebuild for native changes (icon,
version, new shortcuts, notification setup).
