# 🍏 Guideon — iPhone App Guide (no Mac needed)

Build & publish the iPhone app entirely from Windows, using a cloud Mac.
Bundle ID: **om.guideon.app** · App name: **Guideon**

---

## Overview
```
PWABuilder iOS package (have it ✅)
   → push to GitHub
   → Codemagic builds it on a cloud Mac + signs it
   → uploads to App Store Connect
   → submit for Apple review → live on App Store
```

You need: an **Apple Developer account ($99/yr)** and a **Codemagic** account (free tier works to start). No physical Mac.

---

## STEP 1 — Apple ID (free)
If you don't already have one:
- Create: https://account.apple.com  (use hh92hh@guideon.om or any email)
- Turn ON **two-factor authentication** (required by Apple).

## STEP 2 — Apple Developer Program ($99/year)
- Enroll: https://developer.apple.com/programs/enroll
- Choose **Individual** (fastest, no D-U-N-S) — or Organization (needs D-U-N-S).
- Pay **$99/year**. Approval is usually minutes–48h.
- Account home: https://developer.apple.com/account

## STEP 3 — Register the App ID (Bundle ID)
- Go to: https://developer.apple.com/account/resources/identifiers/list
- Click **+** → App IDs → App → Continue.
- Description: `Guideon` · Bundle ID (explicit): `om.guideon.app`
- Enable capabilities you use (Push Notifications optional). → Register.

## STEP 4 — Create the app in App Store Connect
- Go to: https://appstoreconnect.apple.com → **My Apps** → **+ → New App**
- Platform: iOS · Name: `Guideon` · Language: English · Bundle ID: `om.guideon.app`
- SKU: `guideon-ios-001` (any unique text) → Create.
- Fill the listing later (description, screenshots) — content is ready in APP_BUILD_PLAN.md.

## STEP 5 — App Store Connect API key (lets Codemagic sign & upload)
- Go to: https://appstoreconnect.apple.com/access/integrations/api
- Click **+** → name `Codemagic` → Access: **App Manager** → Generate.
- Download the **.p8 key file** (one-time download — keep it safe!)
- Note the **Key ID** and **Issuer ID** shown on that page.

## STEP 6 — Put the iOS project on GitHub
- Unzip the PWABuilder iOS package.
- Create a new **private** repo (e.g. `guideon-ios`) at https://github.com/new
- Upload/push the unzipped project files to it.
  (Easiest: GitHub Desktop https://desktop.github.com → drag the folder → publish.)

## STEP 7 — Build on Codemagic (the cloud Mac)
- Sign up: https://codemagic.io/signup  (sign in with GitHub)
- **Add application** → pick the `guideon-ios` repo → project type: **iOS App (Xcode)**.
- In **Settings → Code signing (iOS)**:
  - Add the **App Store Connect API key** (.p8 + Key ID + Issuer ID from Step 5).
  - Bundle ID: `om.guideon.app` → automatic signing.
- In **Publishing**: enable **App Store Connect** (uses the same API key) → TestFlight.
- Click **Start new build** → Codemagic builds on a Mac and uploads to App Store Connect.

## STEP 8 — Submit for review
- In App Store Connect → your app → the build appears under **TestFlight** (test it on your iPhone via the TestFlight app).
- Then **App Store** tab → add screenshots + description → **Add for Review** → **Submit**.
- Apple review: typically 1–3 days.

---

## What each thing costs / needs
| Item | Cost | Link |
|---|---|---|
| Apple ID | Free | https://account.apple.com |
| Apple Developer Program | $99 / year | https://developer.apple.com/programs/enroll |
| Codemagic | Free tier to start | https://codemagic.io |
| GitHub | Free | https://github.com |
| Mac | **Not needed** (cloud) | — |

---

## Notes / gotchas
- Apple sometimes rejects "just a website" wrappers. Our app has offline support,
  push, and real app features, which helps. If rejected, they tell you what to fix.
- Screenshots: take them from the app running on an iPhone (or TestFlight) — Apple
  requires 6.7" and 6.5" iPhone screenshots.
- Privacy policy URL: https://guideon.om/privacy  · Support URL: https://guideon.om

---

## Recommended order
Android is almost done (account created — just identity + device checks).
Finish Android first (live in days), then do iPhone with the steps above.
