# 📱 Guideon — Official App Build Plan (Android + iOS)

Strategy: **TWA / PWA wrapper** via [PWABuilder](https://www.pwabuilder.com) —
wraps the live site `https://guideon.om` into native app shells. Updates to the
site appear instantly with no app-store re-submission.

Package ID (must stay constant everywhere): **`guide.guideon.twa`**

---

## ✅ Technical readiness (done)

| Item | Status |
|---|---|
| HTTPS live domain | ✅ guideon.om |
| PWA manifest (no BOM, valid) | ✅ |
| Service worker + offline | ✅ /sw.js |
| Icons 192 / 512 / maskable / svg | ✅ |
| .well-known/assetlinks.json | ✅ (fingerprint must match Play signing key — see Step A4) |
| Web Push (VAPID) | ✅ |

---

## 🤖 PHASE 1 — Android (Google Play)

### A1. Create the Play Console account  *(you must do this — payment + ID)*
1. Go to https://play.google.com/console → sign in with **a Google account you control**
   (recommend a dedicated one, e.g. the guideon Google account, not personal).
2. Choose **Organization** account type (you're a company).
3. Pay the **one-time $25** fee.
4. Verify identity (Google asks for ID / D-U-N-S for orgs). This can take 1–3 days.

### A2. Generate the Android package (PWABuilder)
1. Open https://www.pwabuilder.com → enter `https://guideon.om` → **Start**.
2. **Package For Stores → Android**.
3. Settings:
   - Package ID: `guide.guideon.twa`
   - App name: `Guideon`
   - Launcher name: `Guideon`
   - App version: `1.0.0` · Version code: `1`
   - Display: `Standalone` · Orientation: `Portrait`
   - Theme color: `#0f7b6c` · Background: `#0f7b6c` · Nav/status: `#0f1c3e`
   - Signing key: **"Let PWABuilder generate"** (download & KEEP the `.keystore` + passwords safe!)
4. Download the ZIP → contains `app-release-bundle.aab` (upload this) + `signing-key-info.txt`.

### A3. Upload to Play Console
1. **Create app** → name `Guideon`, language, free.
2. Fill the store listing (use the content in the section below).
3. **Production → Create release** → upload the `.aab`.
4. Complete: content rating, data-safety form, privacy policy URL
   (`https://guideon.om/privacy`), target audience.

### A4. ⚠️ Fix Digital Asset Links (critical — removes the browser URL bar)
After upload, Play uses **its own** app-signing key. Get its SHA-256:
**Play Console → your app → Setup → App signing → "SHA-256 certificate fingerprint"**.
Then update `public/.well-known/assetlinks.json` so the fingerprint matches, and redeploy.
(The current value is a placeholder/old key and must be replaced.)

---

## 🍏 PHASE 2 — iOS (App Store)

### B1. Apple Developer account  *(you must do this)*
- https://developer.apple.com/programs → enroll → **$99/year**.
- Organization enrollment needs a **D-U-N-S number** (free, ~1–2 weeks if you don't have one).

### B2. Build the iOS package
- PWABuilder → **iOS** → download the Xcode project.
- Needs a **Mac** with Xcode (or a cloud Mac service like MacStadium/Codemagic) to open,
  set the Bundle ID `guide.guideon.twa`, sign, and archive.
- Upload via Xcode/Transporter to **App Store Connect**.

> iOS is stricter: Apple sometimes rejects pure web-wrapper apps. We'll add native-feeling
> touches (offline, push, share) to satisfy review. Start with Android while the Apple
> D-U-N-S / enrollment processes.

---

## 📝 STORE LISTING CONTENT (ready to paste)

### App name
- EN: `Guideon: Oman Tour Guides`
- AR: `Guideon: مرشدون سياحيون في عُمان`

### Short description (≤ 80 chars)
- EN: `Book licensed local tour guides across Oman — deserts, forts, fjords & more.`
- AR: `احجز مرشدين سياحيين معتمدين في عُمان — صحاري، قلاع، خوران وأكثر.`

### Full description (EN)
```
Discover Oman with Guideon — the easiest way to find and book licensed, local
tour guides across the Sultanate.

• Browse verified guides by destination, language, price and specialty
• See real reviews, photos and tour packages
• Book in seconds and chat directly with your guide
• Explore Muscat, Nizwa, Wahiba Sands, Salalah, Musandam and beyond
• Secure payments and instant booking confirmations

Whether it's a desert safari, a mountain hike, a heritage walk or a dhow cruise,
Guideon connects you with the right expert for an unforgettable Omani journey.
```

### Full description (AR)
```
اكتشف عُمان مع Guideon — أسهل طريقة للعثور على مرشدين سياحيين محليين معتمدين وحجزهم
في جميع أنحاء السلطنة.

• تصفّح المرشدين الموثّقين حسب الوجهة واللغة والسعر والتخصص
• شاهد تقييمات وصور وباقات حقيقية
• احجز في ثوانٍ وتواصل مباشرة مع مرشدك
• استكشف مسقط، نزوى، رمال الوهيبة، صلالة، مسندم وأكثر
• مدفوعات آمنة وتأكيد فوري للحجوزات

سواء كانت رحلة سفاري صحراوية، أو تسلق جبلي، أو جولة تراثية، أو رحلة بحرية —
يربطك Guideon بالخبير المناسب لتجربة عُمانية لا تُنسى.
```

### Keywords / tags
`Oman, tour guide, travel, Muscat, Nizwa, Salalah, desert safari, tourism, booking, Musandam`

### Category
Travel & Local

### Graphics you'll need to provide
- Feature graphic 1024×500 (Play)
- 2–8 phone screenshots (take from the running app on a phone/emulator)
- App icon 512×512 ✅ (already have `/icon-512.png`)

---

## 🔑 Things only YOU can do (accounts / payments / signing)
- Create the Google Play & Apple Developer accounts and pay the fees.
- Run PWABuilder and keep the signing keystore + passwords safe (losing them = can't update the app).
- Upload the packages and submit for review.

I (the dev side) handle: keeping the PWA perfect, updating `assetlinks.json` once you
have the Play signing fingerprint, privacy policy, and any site changes review needs.
