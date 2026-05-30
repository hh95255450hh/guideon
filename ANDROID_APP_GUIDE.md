# 📱 Guideon Android App — Play Store Publishing Guide

## 🎯 Strategy: TWA (Trusted Web Activity)

We're NOT building a new mobile app from scratch. Instead, we wrap your existing PWA (which is already 95% ready) into a tiny Android shell — a **TWA**. Benefits:

- ✅ Uses your live site `https://guideon.om` — every update appears instantly, no app-store re-submission
- ✅ Full-screen, no browser bar (looks/feels native)
- ✅ Tiny APK (<1 MB)
- ✅ Works offline (your existing service worker)
- ✅ Push notifications supported
- ✅ Cost: only the **one-time $25 Play Console fee** + your time
- ✅ Build time: 30 minutes (no Android Studio, no Java code)

---

## 📋 Pre-requisites Checklist

| Item | Status |
|---|---|
| HTTPS live domain | ✅ guideon.om |
| PWA manifest.json | ✅ /manifest.json |
| Service worker | ✅ /sw.js |
| 512×512 icon | ✅ /icon-512.png |
| Maskable icon | ✅ included |
| .well-known/assetlinks.json file | ✅ added (need to fill SHA-256) |
| Lighthouse PWA score ≥ 80 | ⚠️ test before submitting |
| Google Play Console account ($25 one-time) | ⏳ create at https://play.google.com/console |

---

## 🚀 Step-by-Step Publishing

### STEP 1 — Verify your PWA passes Lighthouse audit

1. Open Chrome → visit https://guideon.om
2. F12 → **Lighthouse** tab
3. Check ✅ **"Progressive Web App"** + **"Mobile"**
4. Click **Analyze page load**
5. Confirm PWA score ≥ 80 (or fix anything red before continuing)

### STEP 2 — Generate the Android APK using PWABuilder (easiest)

PWABuilder is a free Microsoft tool that converts any PWA → Play-Store-ready APK.

1. Visit **https://www.pwabuilder.com**
2. Enter `https://guideon.om` → click **Start**
3. Wait ~20 seconds for analysis
4. Click **Package For Stores** → **Android**
5. Fill in:
   - **Package ID**: `guide.guideon.twa`  (must match assetlinks.json on the site — already set)
   - **App Name**: `Guideon`
   - **Launcher name**: `Guideon`
   - **Version**: `1.0.0`
   - **Version code**: `1`
   - **Display mode**: `Standalone`
   - **Orientation**: `Portrait`
   - **Theme color**: `#0f7b6c`
   - **Background color**: `#0f7b6c`
   - **Status bar color**: `#0f1c3e`
   - **Splash fade duration**: `300`
   - **Signing key**: **"New"** (PWABuilder generates one and includes it in the zip — KEEP THIS FILE FOREVER, you can't update the app without it)
   - **Key alias**: `guideon`
   - **Key password**: pick a strong one and SAVE IT
6. Click **Download** → you get a zip containing:
   - `app-release-bundle.aab` ← this is what you upload to Play
   - `app-release-signed.apk` ← optional, for testing
   - `assetlinks.json` ← the file with the SHA-256 fingerprint
   - `signing.keystore` + `signing-key-info.txt` ← **GUARD THESE WITH YOUR LIFE**
   - README.html with the exact next steps

### STEP 3 — Upload the SHA-256 fingerprint to your site

1. Open `assetlinks.json` from the zip — copy the SHA-256 fingerprint
2. Open `public/.well-known/assetlinks.json` in your project
3. Replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT_FROM_PLAY_CONSOLE` with the actual fingerprint
4. Commit + push to GitHub → Railway auto-deploys in ~30 seconds
5. Verify: open `https://guideon.om/.well-known/assetlinks.json` in browser — it must return the JSON with the real fingerprint (this is what tells Android "this app is officially mine")

### STEP 4 — Create a Google Play Console account

1. Visit **https://play.google.com/console**
2. Sign up — **one-time $25 fee** with credit card
3. Verify identity (Google will email you — takes ~24 hours)

### STEP 5 — Create the app in Play Console

1. **Create app** → 
   - Name: `Guideon — Oman Tourist Guide`
   - Default language: English (or Arabic — your choice)
   - **App or game**: App
   - **Free or paid**: Free
   - Tick all declaration boxes

2. **Set up your app** → walk through each item:

#### 📝 Required Items

| Section | What to put |
|---|---|
| **Privacy policy URL** | `https://guideon.om/privacy.html` |
| **App access** | "All functionality available without restrictions" |
| **Ads** | "No, my app does not contain ads" |
| **Content rating** | Fill the questionnaire (it's a travel/booking app — answer no to all sensitive questions) |
| **Target audience** | 18+ (since users book tours/handle money) |
| **News app** | No |
| **COVID-19 contact-tracing** | No |
| **Data safety** | Disclose: email, name, phone, location, payment info. Used for: app functionality. NOT shared with third parties (except providers like Stripe). |

#### 🎨 Store Listing — what tourists see

| Field | What to put |
|---|---|
| **App name** | Guideon — Oman Tourist Guide |
| **Short description** (80 chars) | Book certified local guides across Oman — Muscat, Salalah, Musandam & more. |
| **Full description** (4000 chars) | Use template below |
| **App icon** | upload your 512×512 icon |
| **Feature graphic** | 1024×500 banner (use Canva — search "Play Store feature graphic") |
| **Phone screenshots** | At least 2, max 8. Take screenshots of homepage, search, guide profile, booking page from your phone Chrome |
| **Tablet screenshots** | Optional but recommended |
| **Category** | Travel & Local |
| **Tags** | Tourism, Travel, Oman, Booking |
| **Contact details** | email: `Hh95255450hh@hotmail.com`, phone: `+96895255450`, website: `https://guideon.om` |

### STEP 6 — Upload the AAB

1. Left sidebar → **Production** → **Create new release**
2. Drag-drop the **`app-release-bundle.aab`** from PWABuilder
3. **Release name**: `1.0.0 — Initial launch`
4. **Release notes** (each language):
   ```
   🎉 Welcome to Guideon!
   • Book certified local tourist guides across Oman
   • Browse tours in Muscat, Nizwa, Salalah, Musandam, and more
   • Direct chat with guides before booking
   • Free cancellation up to 48 hours
   • Available in Arabic & English
   ```
5. Click **Next** → **Review release** → **Start rollout to Production**

### STEP 7 — Wait for review

- Google reviews apps in **2-7 days** (sometimes hours)
- You'll get an email when approved or if changes are needed
- Once live, app appears at:
  `https://play.google.com/store/apps/details?id=guide.guideon.twa`

---

## 📄 Full Description Template (copy this)

```
Discover Oman with Guideon — the official platform connecting travelers with certified Ministry-licensed tourist guides across the Sultanate.

🌍 WHY GUIDEON
• Every guide is verified and holds a valid licence from Oman's Ministry of Heritage & Tourism
• Read real reviews from previous travelers
• Direct chat with your guide before booking — ask questions, agree on details
• Free cancellation up to 48 hours before your tour
• Bad weather refund — guaranteed

🗺️ EXPLORE EVERY REGION
• Muscat — Sultan Qaboos Grand Mosque, Muttrah Souq, Royal Opera House
• Nizwa — Historic fort, silver souq, Friday goat market
• Salalah — Magical Khareef season, frankincense trail
• Musandam — "Norway of Arabia" fjords, dolphin watching
• Wahiba Sands — Desert safari + Bedouin camps
• Wadi Shab — Crystal-clear pools and hidden waterfall caves
• Ras al-Jinz — Green sea turtle nesting

💼 TOUR PACKAGES
Each tour offers multiple tiers (Standard / Premium / VIP) with optional add-ons like hotel pickup, professional photography, or premium lunch. Transparent pricing with no hidden fees.

🔒 SAFE & SECURE
• HTTPS encrypted
• Optional Two-Factor Authentication
• Your deposit held until tour completion
• Verified guide identities

🌐 BILINGUAL
Full Arabic and English support — switch languages with one tap.

📞 SUPPORT
Need help? WhatsApp +968 9525 5450 or email Hh95255450hh@hotmail.com

Download Guideon and discover the real Oman with someone who knows it best.

guideon.om
```

---

## ⚠️ Common Mistakes to Avoid

| Mistake | Consequence |
|---|---|
| Skipping the SHA-256 step in assetlinks.json | App opens with Chrome address bar showing (looks like a webview) |
| Losing your signing keystore | **You can never update the app again** — would need a NEW Play Store listing |
| Using "myapp.test" or other invalid package ID | Play Console rejects |
| Bad screenshots (too small / blurry) | Listing looks unprofessional, low conversion |
| Empty privacy policy | Auto-rejected by Google |
| Incomplete data safety form | Auto-rejected by Google |

---

## 🔄 Future Updates

When you push code to GitHub → site updates → **app updates automatically** (because it's a TWA).

You only need to upload a NEW AAB to Play Store when:
- Changing the icon
- Changing the package name (don't!)
- Major Android API targeting requirements (Google emails you)
- Big visual rebrand

For normal feature additions / bug fixes / content updates → **nothing to do**.

---

## 💰 Total Cost

| Item | Cost |
|---|---|
| Google Play Console (one-time) | $25 |
| PWABuilder | $0 (free) |
| Hosting (Railway) | already paid |
| Domain | already paid |
| **TOTAL FIRST YEAR** | **$25** |

---

## 🎁 Bonus — iOS App Store

After you finish Android, the same PWABuilder.com can produce an iOS package. But iOS requires:
- Apple Developer account ($99/year)
- A Mac (or rent one online for a few hours)
- Manual review by Apple (1-2 weeks)

Suggest doing Android first → seeing demand → then iOS.

---

## 🆘 If You Get Stuck

- PWABuilder Discord: https://discord.gg/pwabuilder
- Play Console support: https://support.google.com/googleplay/android-developer/
- Ask me — I can help you fill any form or debug any error.
