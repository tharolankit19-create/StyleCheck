# Production Guide — Earn Your Screen Time

This doc covers the steps to ship Earn Your Screen Time to the Google Play
Store and how to evolve the MVP into a production-grade enforcement layer.

## 1. Build & sign an AAB locally

```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

For local dev builds:

```bash
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### Signing

1. Generate a release keystore (do this once, store it somewhere safe):

   ```bash
   keytool -genkey -v \
     -keystore earnyst-release.keystore \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias earnyst
   ```

2. Add the keystore to `~/.gradle/gradle.properties` (never commit it):

   ```
   EARNYST_RELEASE_STORE_FILE=/absolute/path/to/earnyst-release.keystore
   EARNYST_RELEASE_KEY_ALIAS=earnyst
   EARNYST_RELEASE_STORE_PASSWORD=...
   EARNYST_RELEASE_KEY_PASSWORD=...
   ```

3. Add a `signingConfigs.release` block in `android/app/build.gradle` that
   reads from those properties and reference it from `buildTypes.release`.

## 2. Google Play submission checklist

- [ ] App icon (adaptive, all sizes) under `android/app/src/main/res/mipmap-*/`.
- [ ] Feature graphic 1024×500.
- [ ] Short description (≤ 80 chars) and full description.
- [ ] Privacy policy URL (hosted). It must declare: on-device camera use only,
      no upload, what data is stored locally.
- [ ] Content rating questionnaire filled in (this app is rated E/I for all).
- [ ] Data safety form:
      - Data collected: none shared. Data stored locally on-device only.
      - Security: data encrypted at rest by Android (FDE).
      - User controls: user can clear local data from the Settings screen.
- [ ] Permissions disclosure: camera (foreground), usage access (foreground).
- [ ] Target API: latest stable. `targetSdkVersion` is wired in
      `android/variables.gradle`.
- [ ] AAB signed with the upload key registered in Play Console.

## 3. Real Android app blocking (production-grade)

The MVP ships foreground detection (`ForegroundAppPlugin` via
`UsageStatsManager`) and surfaces the user's blocked apps in the dashboard.
This is honest UX: the OS does not allow third-party apps to silently block
other apps without one of the following elevated capabilities.

### Path A — Device Owner / MDM (recommended)

1. Sideload the app via ADB as device owner:

   ```bash
   adb install app-release.apk
   adb shell dpm set-device-owner com.earnyst.app/.App
   ```

2. Once enrolled, the app can call `DevicePolicyManager.setPackagesSuspended()`
   on the user's blocked packages.

3. Wrap that call in a Kotlin service that watches
   `UsageStatsManager` for the foreground package, compares against the
   user's wallet balance, and suspends the package when balance = 0.

4. Build a small "Enroll as Device Owner" screen in the app that opens an
   intent to a companion admin app or walks the user through
   `adb dpm set-device-owner`.

### Path B — AccessibilityService (less robust)

1. Declare an AccessibilityService in the manifest.
2. Inside `onAccessibilityEvent`, detect `TYPE_WINDOW_STATE_CHANGED` and
   read the foreground package.
3. If the package is in the blocked list and balance ≤ 0, call
   `performGlobalAction(GLOBAL_ACTION_HOME)` or render a blocking
   activity on top.

This path is explicitly disallowed by Google Play for app-locking categories
*unless* the app is declared as a productivity/launcher. Use it only for
personal builds.

## 4. Cloud sync (Supabase-ready, optional)

The storage layer (`src/storage/contract.ts`) is interface-based. To swap in
Supabase:

1. Implement a `SupabaseStore` against the same `Store` interface.
2. Wire it in `src/state/store.ts → bootstrap()`.
3. Mirror wallet balance server-side for cross-device continuity. The
   client remains authoritative for rep verification; the server is the
   ledger of record.

## 5. App Store / iOS (future)

Capacitor supports iOS with the same web layer. The pose detection model
already runs in the browser via MediaPipe. To ship to iOS:

```bash
npm install @capacitor/ios
npx cap add ios
npx cap sync ios
cd ios && pod install
open EarnYourScreenTime.xcworkspace
```

Real iOS app blocking requires Family Controls / Screen Time API and is
restricted to apps in the "Family" or "Productivity" categories.

## 6. Continuous Integration

`.github/workflows/ci.yml` already:

- Runs `npm run typecheck`, `npm test`, `npm run build`.
- Builds a debug APK on every push.

For signed release builds, set the following GitHub Actions secrets:

- `EARNYST_KEYSTORE_B64` — base64 of the keystore file
- `EARNYST_KEYSTORE_PASSWORD`
- `EARNYST_KEY_ALIAS`
- `EARNYST_KEY_PASSWORD`

Then add a `release` job that decodes the keystore, runs
`./gradlew bundleRelease`, and uploads the AAB to the Play Store via the
`r0adkll/upload-google-play@v1` action.

## 7. Anti-cheat hardening roadmap

- [ ] Add device-side liveness checks (blink detection) during onboarding.
- [ ] Compare `SystemClock.elapsedRealtime()` against `Date.now()` to flag
      wall-clock rollback (already wired via `ScreenTimeGuardPlugin`).
- [ ] Track per-second landmark variance; if the camera is locked on a
      still image the rep counter should idle.
- [ ] Add a server-side counter-check (when cloud sync is enabled).
- [ ] Add a "face not in frame" guard using the nose landmark.
- [ ] Use a confidence-weighted angle, not just the raw average.

## 8. Privacy posture

Earn Your Screen Time processes camera frames on-device only. The camera
stream never leaves the device. The ledger is local. No third-party
analytics SDKs are bundled. Update the privacy policy before launch to
reflect this.