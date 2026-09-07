# Earn Your Screen Time

A real application that locks you out of distracting apps until you earn the
time. Push-ups, squats, and other on-device verifiable exercises convert into
minutes of access. Everything runs locally — no video ever leaves your device.

- **Web app**: PWA-quality, runs entirely in the browser with IndexedDB.
- **Android app**: Capacitor + Kotlin native plugins for system integration,
  buildable to APK/AAB and shippable to Google Play.

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 18 + TypeScript + Vite |
| State | Zustand |
| Routing | react-router-dom |
| Pose detection | MediaPipe Pose (WASM/WebGL on web, native lib on Android) |
| Storage (web) | IndexedDB |
| Storage (native) | Capacitor Preferences + SQLite plugin |
| Native shell | Capacitor 6 + Kotlin plugins |
| Anti-cheat | Multi-landmark state machine, debouncing, configurable thresholds |

## Quick start (web)

```bash
npm install
npm run dev
npm run build
```

The build output goes to `dist/`. You can host it on any static host
(Netlify, Vercel, GitHub Pages, S3+CloudFront, etc.).

## Android build

```bash
npm install
npm run build
npx cap add android    # first time only
npx cap sync android
cd android
./gradlew assembleRelease   # APK
./gradlew bundleRelease     # AAB for Play Store
```

The Android module ships with two custom Kotlin plugins:

- `ScreenTimeGuard` — exposes `SystemClock.elapsedRealtime()` so the wallet can
  detect wall-clock rollback, lists installed apps, opens Usage Access settings.
- `ForegroundApp` — reads `UsageStatsManager` to learn which app is currently
  in the foreground, so the app can intervene with a lock screen when the
  wallet balance is empty and the foreground package is on the user's blocked
  list.

> Production-grade app blocking on Android requires either a Device Owner
> enrollment (enterprise/MDM) or a long-lived AccessibilityService. The MVP
> ships the foreground-detection path plus an in-app block screen. The full
> Device Owner flow is described in [`PRODUCTION.md`](./PRODUCTION.md).

## Repository layout

```
src/
  components/        reusable UI building blocks
  screens/           one file per screen (onboarding, dashboard, exercise…)
  state/             zustand store + bootstrap
  storage/           persistence: contract + IndexedDB implementation
  pose/              MediaPipe wiring + rep-engine state machine
  wallet/            screen-time wallet: tick, earn, spend, format
  exercises/         exercise registry (push-ups, squats, pluggable)
  rules/             earning rule helpers
  native/            Capacitor plugin bridges + native detection
  lib/               types, hooks, helpers
  styles/            design system / global CSS

android/             Capacitor Android project skeleton (Kotlin + Gradle)
native-plugins/      Source of truth for custom Kotlin Capacitor plugins
public/              static assets
.github/workflows/   CI: web build + Android APK + Android AAB
```

## Architecture

### Rep counter

A three-state machine:

```
       ↓elbow≤downAngleDeg             ↓elbow≥upAngleDeg
READY ────────────► DOWN ────────────► UP ────────────► count!
  ▲                  │                   │
  └──────────────────┴───────────────────┘
                body-not-visible / misaligned
```

- `upAngleDeg` default **155°**, `downAngleDeg` default **95°** — both
  configurable from settings.
- A rep counts only on a full `UP → DOWN → UP` cycle.
- Each frame requires minimum landmark confidence
  (`minConfidence`, default 0.55) **and** visible body for
  `bodyVisibilityFramesRequired` consecutive frames.
- A rep must take between `minRepMs` (default 700 ms) and `maxRepMs`
  (default 5 s) — anything outside that window is rejected.
- A cooldown (`cooldownMs`, default 250 ms) blocks ghost reps from camera
  jitter.
- Rejected reps are tallied separately and shown to the user.

### Screen-time wallet

A ledger of `earn` and `spend` entries, persisted to IndexedDB / SQLite.
`availableSeconds` is *never* a UI countdown — it is recomputed from
`lastTickAt` on every read so killing and reopening the app cannot reset
or extend the balance. The wallet also reads `SystemClock.elapsedRealtime()`
through the native plugin to detect wall-clock rollback.

### Onboarding flow

1. Intro card: "Your screen time is no longer free. Earn it."
2. App selection with explicit toggles and "what this means" copy.
3. Rule selection with toggleable defaults + a custom-rule form.
4. Permissions screen explaining camera + notifications, with reason text.
5. Dashboard.

### Anti-cheat

- Multi-landmark angle (shoulder→elbow→wrist on both sides) — never a
  single landmark.
- Configurable angle thresholds + timing windows.
- Minimum body visibility over multiple frames before any state change.
- Cooldown between counted reps.
- All processing on-device; the camera is never uploaded.
- Native `elapsedRealtime` cross-check for clock rollback.

## Tests

```bash
npm test
```

Includes a state-machine test for push-up counting, angle math tests, and
wallet rule-matching tests.

## Configuration (env vars)

None required for the offline MVP. Cloud sync via Supabase is architected but
not wired — see `src/storage/contract.ts` for the storage interface you'd
implement with `supabase-js` when ready.

## CI / CD

`.github/workflows/ci.yml` builds the web app, runs tests, then assembles
both an APK and an AAB on every push and PR. See `PRODUCTION.md` for
Play Store submission steps.