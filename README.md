# StyleCheck

Upload a full-body photo, get an **honest, deterministic score (2.0–9.0)**, one
witty one-liner, and a style category. Behind a paywall: a full five-dimension
breakdown and an **AI restyle** of the same person in a better-coordinated
outfit.

Built with Flutter (Android + iOS), Firebase (Anonymous Auth, Storage, Cloud
Functions, Firestore, App Check, Crashlytics, Analytics), RevenueCat, Google
Cloud Vision, and Replicate.

> **Shipping to the stores?** Follow [`PRODUCTION.md`](PRODUCTION.md) — it maps
> the RevenueCat/Firebase setup, App Check, native config, and store submission
> end to end.

---

## Table of contents

1. [How it works](#how-it-works)
2. [Architecture](#architecture)
3. [The deterministic scoring engine](#the-deterministic-scoring-engine)
4. [Security model](#security-model)
5. [Repository layout](#repository-layout)
6. [Prerequisites](#prerequisites)
7. [Setup — step by step](#setup--step-by-step)
8. [Environment variables (the exact list)](#environment-variables-the-exact-list)
9. [Running the app](#running-the-app)
10. [Deploying the backend](#deploying-the-backend)
11. [Platform (native) setup](#platform-native-setup)
12. [Testing](#testing)

---

## How it works

```
 ┌────────────┐   photo    ┌──────────────┐  gs:// path   ┌───────────────────┐
 │  Flutter   │ ─────────► │ Cloud Storage │ ────────────►│  analyzeOutfit     │
 │  client    │            └──────────────┘               │  (Cloud Function)  │
 │            │  callable  ┌───────────────────────────────────────────────┐  │
 │            │ ─────────► │ Vision → features → deterministic score →       │  │
 │            │            │ critique → Firestore (cached by image SHA-256)  │  │
 │            │ ◄───────── │ returns { score, critique, category }           │  │
 │            │            └───────────────────────────────────────────────┘  │
 │            │  premium   ┌───────────────────┐   Replicate   ┌────────────┐  │
 │            │ ─────────► │ generateBetterOutfit│ ───────────►│  Replicate │  │
 │            │ ◄───────── │ (restyle, gated)    │ ◄───────────│            │  │
 └────────────┘            └───────────────────┘               └────────────┘
        ▲  entitlement mirrored by RevenueCat webhook → users/{uid}.premium
        └──────────────────────────────────────────────────────────────────────
```

- **Free**: score + one-liner + category.
- **Premium** (RevenueCat entitlement `StyleCheck Pro`): detailed breakdown + AI
  restyle + unlimited daily checks.
- **Anonymous auth only** — no signup, no email, no social login.

---

## Architecture

**Client (Flutter)**

- **State management**: [Riverpod](https://riverpod.dev). Services are provided
  behind interfaces so the whole app swaps between a **live** backend stack and a
  fully **offline mock** stack with a single `--dart-define`.
- **Navigation**: `go_router` with custom transitions.
- **Structure**: feature-first (`features/*`) over a shared `core/*` (theme,
  widgets, config, providers) and `data/*` (models, services, repositories).
- **Flow**: a single `AnalysisController` (state machine: `idle → analyzing →
  done | error`) drives capture → loading → the score reveal.
- **Subscriptions**: `purchases_flutter` for entitlements/customer info +
  `purchases_ui_flutter` for RevenueCat's prebuilt **Paywall** and **Customer
  Center**. `PaywallLauncher` presents the native paywall in live mode and falls
  back to an in-app paywall otherwise. The `premium` flag is kept live via the
  CustomerInfo update stream and read app-wide through Riverpod.

**Server (Cloud Functions, TypeScript / Node 20)**

- `analyzeOutfit` (callable) — Vision detection → deterministic scoring →
  critique → Firestore. Enforces auth, per-day free quota, and dedupes on the
  image SHA-256.
- `generateBetterOutfit` (callable, premium-gated) — builds a restyle prompt
  from detected features, calls Replicate, stores the result, returns a signed
  URL. Cached per analysis.
- `revenuecatWebhook` (HTTP) — verifies a shared secret and mirrors the premium
  entitlement onto `users/{uid}`.

---

## The deterministic scoring engine

> **Hard constraint:** same image ⇒ same score, always. No randomness anywhere.

The score is a **pure function of detected features** (`functions/src/scoring/`):

1. **Vision** returns dominant colors, localized garment objects, labels, and
   face count (`services/vision.ts`).
2. **`features.ts`** turns that into structured features: a color palette
   (chromatic hues vs. neutral ratio), detected garments mapped onto a
   **formality axis**, silhouette proportion, and body framing.
3. **`scoreEngine.ts`** computes five weighted sub-scores — Color Harmony (0.30),
   Formality Match (0.24), Palette Discipline (0.18), Fit & Proportion (0.16),
   Framing (0.12) — and maps the composite through a gentle S-curve onto
   **2.0–9.0**, rounded to one decimal.
4. **`critique.ts`** selects one witty line via a stable FNV-1a hash of a
   quantized feature signature, so the burn is varied across outfits but
   identical for the same one — and can target the weakest dimension.

Determinism is guaranteed two ways: the algorithm has **zero** `Math.random` /
time inputs, **and** the result is cached in Firestore keyed by the image's
SHA-256, so an identical upload always returns the identical stored verdict.

Run the engine's tests:

```bash
cd functions && npm install && npm test
```

---

## Security model

- **No third-party key ever ships in the client.** Replicate + RevenueCat webhook
  secrets live only in Cloud Functions (Secret Manager). Vision uses the
  function's service account (Application Default Credentials) in production.
- The client only holds the **public** Firebase client config and the
  **public** RevenueCat SDK key — both injected at build time via
  `--dart-define`, never committed.
- **The client cannot set its own score or entitlement.** Firestore rules make
  `analyses/*` and `users/*` writes server-only; premium is set exclusively by
  the RevenueCat webhook. See `firestore.rules` and `storage.rules`.
- Storage uploads are namespaced to `uploads/<uid>/…` and size/content-type
  capped.
- **App Check** attests calls come from a genuine app build; the callables reject
  everything else when `ENFORCE_APP_CHECK=true`. Server gating additionally
  honors RevenueCat Firebase Extension custom claims, so a client can never forge
  premium.

---

## Repository layout

```
StyleCheck/
├── app/                      # Flutter app
│   ├── lib/
│   │   ├── core/             # config, theme (design system), router, widgets, providers
│   │   ├── data/             # models + services (live + mock) + repositories
│   │   └── features/         # capture, analysis, result (score reveal), paywall, premium
│   └── test/                 # determinism tests
├── functions/                # Cloud Functions (TypeScript)
│   └── src/
│       ├── scoring/          # color.ts, features.ts, scoreEngine.ts, critique.ts (+ tests)
│       ├── services/         # vision.ts, replicate.ts
│       ├── analyzeOutfit.ts  # core callable
│       ├── generateBetterOutfit.ts
│       └── revenuecatWebhook.ts
├── firebase.json             # Functions/Firestore/Storage + emulators
├── firestore.rules           # server-only writes for scores & entitlements
├── storage.rules             # per-user upload scoping
├── scripts/                  # run_mock.sh, run_live.sh
└── .env.example              # every variable you need to provide
```

---

## Prerequisites

- **Flutter** ≥ 3.27 (Dart ≥ 3.6), Xcode + Android Studio toolchains
- **Node.js 20** and the **Firebase CLI** (`npm i -g firebase-tools`)
- Accounts: **Firebase/Google Cloud**, **RevenueCat**, **Replicate**

---

## Setup — step by step

### 1. Firebase project

1. Create a Firebase project and enable: **Anonymous Auth**, **Cloud Storage**,
   **Firestore**, and **Cloud Functions** (Functions requires the **Blaze**
   plan).
2. In Google Cloud console for the same project, **enable the Cloud Vision API**.
3. Register an **Android** app and an **iOS** app to get their client config
   values (used below).
4. Put your project id in `.firebaserc` (replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID`).

### 2. RevenueCat

The app uses the RevenueCat SDK (`purchases_flutter`) plus RevenueCat's prebuilt
UI (`purchases_ui_flutter`) for the **Paywall** and **Customer Center**.

1. Create a RevenueCat project; add your App Store and Play Store apps.
2. Create an **entitlement** whose identifier is exactly **`StyleCheck Pro`**.
   This identifier must match `AppConfig.premiumEntitlement` (client) and
   `PREMIUM_ENTITLEMENT` (`functions/src/config.ts`). If your dashboard shows a
   different identifier from the display name, use the identifier in both places.
3. Create **products** and attach them to the entitlement:
   - `yearly` — annual subscription (optionally a 3-day intro trial)
   - `Weekly` — weekly subscription
4. Create an **Offering** (e.g. `default`) with two **packages** — Annual → `yearly`,
   Weekly → `Weekly`. The app reads whatever packages your `current` offering
   exposes, so package identifiers are flexible.
5. Build a **Paywall** on that offering (RevenueCat → Paywalls). The app presents
   this remote-configured paywall via `RevenueCatUI.presentPaywallIfNeeded`. If no
   paywall is configured, the app automatically falls back to its in-app paywall
   screen, so nothing breaks.
6. (Optional) Enable the **Customer Center** (RevenueCat → Customer Center). The
   app exposes it from the home header and the premium section for subscribers
   via `RevenueCatUI.presentCustomerCenter`.
7. Copy the **public SDK keys** (one for Apple, one for Google). The RevenueCat
   **Test Store** key (`test_…`) works on both platforms for sandbox testing
   without App Store / Play configuration.
8. Add a **Webhook** (Integrations → Webhooks) pointing at your deployed
   `revenuecatWebhook` URL, and set an **Authorization header** value — you'll
   store the same value as the `REVENUECAT_WEBHOOK_AUTH` secret. RevenueCat sends
   the Firebase uid as `app_user_id` (the app calls `Purchases.configure` with the
   uid), so entitlements map to the right user server-side.

### 3. Replicate

1. Create a Replicate account and copy your **API token**.
2. Default model is `black-forest-labs/flux-kontext-pro` (image-conditioned
   restyle). Override with the `REPLICATE_MODEL` param if you prefer another.

### 4. Set server secrets

```bash
cd functions
firebase functions:secrets:set REPLICATE_API_TOKEN
firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH
# VISION_API_KEY is only needed for LOCAL emulation; deployed functions use ADC.
```

### 5. Client config

Copy `.env.example` → `.env` and fill in the client values (see the table
below). `.env` is gitignored.

---

## Environment variables (the exact list)

### Client — injected via `--dart-define` (public, not secret)

| Variable | Required | Where to find it |
|---|---|---|
| `FIREBASE_API_KEY` | ✅ | Firebase app config |
| `FIREBASE_APP_ID` | ✅ | Firebase app config (per platform) |
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project settings |
| `FIREBASE_MESSAGING_SENDER_ID` | ✅ | Firebase app config |
| `FIREBASE_STORAGE_BUCKET` | ✅ | e.g. `your-project-id.appspot.com` |
| `FIREBASE_AUTH_DOMAIN` | ⬜ (defaults) | `your-project-id.firebaseapp.com` |
| `FIREBASE_IOS_BUNDLE_ID` | iOS | your iOS bundle id |
| `REVENUECAT_API_KEY` | ✅ | RevenueCat **public** SDK key (per platform) |
| `USE_MOCK` | ⬜ | `true` = offline demo, `false` = live (default in release) |

### Server — Cloud Functions secrets / params (the real secrets)

| Variable | Type | Purpose |
|---|---|---|
| `REPLICATE_API_TOKEN` | secret | Replicate image generation |
| `REVENUECAT_WEBHOOK_AUTH` | secret | Verifies the RevenueCat webhook `Authorization` header |
| `VISION_API_KEY` | secret (local only) | Vision auth when running the emulator; prod uses ADC |
| `REPLICATE_MODEL` | param | Restyle model (default `black-forest-labs/flux-kontext-pro`) |
| `FREE_ANALYSES_PER_DAY` | param | Free daily quota (default `3`) |

---

## Running the app

**Offline demo (zero backend, deterministic fake analysis + placeholder restyle):**

```bash
cd app && flutter pub get
../scripts/run_mock.sh          # or: flutter run --dart-define=USE_MOCK=true
```

**Live (against your Firebase + vendors):**

```bash
cd app && flutter pub get
../scripts/run_live.sh          # reads .env and passes all --dart-define flags
```

> If `USE_MOCK=false` but Firebase config is missing, the app logs a warning and
> falls back to mock mode instead of crashing.

**Release build example:**

```bash
flutter build appbundle \
  --dart-define=USE_MOCK=false \
  --dart-define=FIREBASE_API_KEY=... \
  --dart-define=FIREBASE_APP_ID=... \
  --dart-define=FIREBASE_PROJECT_ID=... \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=... \
  --dart-define=FIREBASE_STORAGE_BUCKET=... \
  --dart-define=REVENUECAT_API_KEY=...
```

---

## Deploying the backend

```bash
# From the repo root:
firebase deploy --only firestore:rules,storage,functions
```

This deploys the security rules and all three functions. Grab the
`revenuecatWebhook` trigger URL from the deploy output and paste it into the
RevenueCat webhook configuration (with the matching Authorization header).

Local emulation:

```bash
cd functions && npm install && npm run serve   # functions + emulator UI
```

---

## Platform (native) setup

The `android/` and `ios/` folders are generated by Flutter. From `app/`:

```bash
flutter create . --platforms=android,ios --org com.yourco
```

Then apply the required permissions (image capture / library):

**iOS — `ios/Runner/Info.plist`:**

```xml
<key>NSCameraUsageDescription</key>
<string>StyleCheck needs the camera to check your outfit.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>StyleCheck needs your photos to check your outfit.</string>
```

Set the iOS deployment target to **15.0+** (required by RevenueCat's Paywall /
Customer Center UI) and run `cd ios && pod install`.

**Android — `android/app/src/main/AndroidManifest.xml`** (camera is optional,
declared non-required so the app installs on camera-less devices):

```xml
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

Set `minSdkVersion` to **24+** in `android/app/build.gradle` (required by
`purchases_ui_flutter`).

**Fonts:** the app uses `google_fonts`, which fetches Archivo/Inter at first run
and caches them. To ship fonts offline, download the TTFs into `app/assets/fonts`
and declare them in `pubspec.yaml`.

---

## Testing

```bash
# Server: deterministic scoring engine
cd functions && npm install && npm test

# Client: determinism + range contract on the analysis service
cd app && flutter test
```

Both suites assert the core guarantee: **identical image ⇒ identical score,
critique, and category**, and that every score lands in **2.0–9.0**.
