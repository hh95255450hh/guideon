# Push Notifications — Firebase setup (one-time)

The app code is already wired (PushService). Push stays **off** until you add
the two config files below — then it activates automatically, no code changes.

Project package / bundle id: **om.guideon.guideon**

## 1. Create the Firebase project (free)
1. Go to https://console.firebase.google.com → **Add project** → name "Guideon".
2. Disable Google Analytics (optional) → Create.

## 2. Add the Android app
1. Firebase console → Add app → **Android**.
2. Android package name: `om.guideon.guideon`.
3. Download **google-services.json**.
4. Place it at: `mobile/android/app/google-services.json`
   (Do NOT commit it — it's fine to commit for Firebase, but keep it out of the
   public repo; instead upload it to Codemagic as an **environment file** named
   `google-services.json` and have CI write it into that path.)

## 3. Add the iOS app
1. Firebase console → Add app → **iOS**.
2. Bundle ID: `om.guideon.guideon`.
3. Download **GoogleService-Info.plist**.
4. Place at: `mobile/ios/Runner/GoogleService-Info.plist` (or upload to Codemagic
   as an environment file, same as Android).

## 4. iOS APNs (required for iOS push)
1. Apple Developer → Keys → **+** → enable **Apple Push Notifications (APNs)** →
   download the `.p8` key. Note the Key ID + your Team ID.
2. Firebase console → Project settings → **Cloud Messaging** → Apple app →
   upload the APNs `.p8` key (+ Key ID + Team ID).
3. In Xcode/Codemagic the app needs the **Push Notifications** capability and
   `aps-environment` entitlement (Codemagic adds it via the provisioning
   profile when the App ID has Push enabled).

## 5. Codemagic — inject the config files at build time (keeps repo clean)
In Codemagic → app settings → Environment variables, add (as **files**):
- `ANDROID_FIREBASE_SECRET` → google-services.json (base64)
- `IOS_FIREBASE_SECRET` → GoogleService-Info.plist (base64)

Then a CI step decodes them before the build. (Ask me to add these steps to
codemagic.yaml once you've created the Firebase project.)

## How push is sent from the backend
The server already stores each device token (`POST /auth/fcm-token`, column
`users.fcm_token`). Sending uses Firebase Admin / FCM HTTP v1 with the project
service account — wire that in `src/services` when you're ready to push from
booking/message events.
