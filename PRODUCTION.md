# StyleCheck — Production Launch Checklist

Everything needed to take StyleCheck from this repo to the App Store & Play
Store. Items marked **[you]** need your accounts/decisions; the rest is wired in
code already.

---

## 1. Configuration wiring

### Client (`--dart-define`, injected by `scripts/run_live.sh` from `.env`)

| Key | Value |
|---|---|
| `FIREBASE_*` | **[you]** from Firebase console → Project settings |
| `REVENUECAT_API_KEY` | `test_jieXlkkqxkvqAwQKrcukAKIeEsy` (Test Store) → swap for prod `appl_…`/`goog_…` at launch |
| `PRIVACY_POLICY_URL` / `TERMS_URL` | default to `style-check-zeta.vercel.app/{privacy,terms}` **[you: publish those pages]** |
| `USE_MOCK` | `false` for real builds |

### Server (Firebase Secret Manager — set interactively, never in a file)

```bash
firebase functions:secrets:set REPLICATE_API_TOKEN       # [you] Replicate token
firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH   # value: b3.*JWkLu4*3$5Q  (only if using Option B below)
```

Non-secret function env (`functions/.env`, gitignored):

```
ENFORCE_APP_CHECK=true
FREE_ANALYSES_PER_DAY=3
REPLICATE_MODEL=black-forest-labs/flux-kontext-pro
```

---

## 2. Entitlement sync — pick ONE path

The entitlement identifier is **`StyleCheck Pro`** everywhere (client
`AppConfig.premiumEntitlement`, server `PREMIUM_ENTITLEMENT`). Server gating
(`functions/src/util/entitlement.ts`) accepts **both** a Firestore user doc and
Firebase Auth **custom claims**, so either path works:

- **Option A — RevenueCat Firebase Extension (recommended).** You already
  generated its shared secret (`Aaba2t…PcyX`). The extension mirrors active
  entitlements to Firestore / custom claims automatically. No custom webhook
  needed for gating. The client already reads entitlements live from the
  RevenueCat SDK.
- **Option B — the included `revenuecatWebhook` Cloud Function.** Deploy it,
  then in RevenueCat → Integrations → Webhooks set the URL to the deployed
  function and the **Authorization header** to the same value as the
  `REVENUECAT_WEBHOOK_AUTH` secret (`b3.*JWkLu4*3$5Q`).

> Your dashboard currently points a webhook at `style-check-zeta.vercel.app`.
> If that Vercel endpoint is your intended backend, have it write
> `users/{uid}.entitlements['StyleCheck Pro'] = true` (or set the auth custom
> claim) so server gating stays in sync. Otherwise switch to Option A/B.

RevenueCat products → offering: **`yearly`** (Annual, 3-day trial) and
**`Weekly`**, attached to the `StyleCheck Pro` entitlement, in your `default`
offering, with a **Paywall** built on it.

---

## 3. Firebase App Check  **[you]**

Abuse protection for the callable functions is wired in the client
(`Observability`) and gated server-side by `ENFORCE_APP_CHECK`.

1. Firebase console → App Check → register **Play Integrity** (Android) and
   **App Attest / DeviceCheck** (iOS).
2. Add a **debug token** for simulators/CI if needed.
3. Set `ENFORCE_APP_CHECK=true` in `functions/.env` and redeploy — only genuine
   app builds can call `analyzeOutfit` / `generateBetterOutfit`.

---

## 4. Native project  **[you]**

Generate platform folders and apply `app/native_templates/` (see its README):

```bash
cd app && flutter create . --platforms=android,ios --org com.yourco --project-name stylecheck
```

- iOS: deployment target **15.0**, add `GoogleService-Info.plist`, add
  `PrivacyInfo.xcprivacy`, enable App Attest, `pod install`.
- Android: `minSdkVersion 24`, add `google-services.json` + Google Services
  plugin, real release signing config + `proguard-rules.pro`.
- App icon + splash: generate with `flutter_launcher_icons` /
  `flutter_native_splash` from your brand mark.

---

## 5. Store readiness  **[you]**

- **Subscriptions**: App Store Connect + Play Console products matching the
  RevenueCat product ids (`yearly`, `Weekly`); paywall shows price, period,
  trial terms, **Restore**, **Terms**, **Privacy** (all wired).
- **Data Safety / App Privacy**: declare Photos (app functionality), Crash data,
  Product interaction (analytics), Purchases — matches `PrivacyInfo.xcprivacy`.
- **Review notes**: mention anonymous auth (no login) and how to reach the
  paywall; provide a sandbox/Test-Store note so reviewers can test premium.
- Screenshots: the score-reveal screen is the hero shot.

---

## 6. Deploy backend

```bash
firebase deploy --only firestore:rules,storage,functions
```

Confirm rules deployed (scores/entitlements are server-write-only) and, for
Option B, paste the `revenuecatWebhook` URL into RevenueCat.

---

## 7. Pre-flight

- [ ] Real prod RevenueCat keys swapped in (not `test_…`)
- [ ] `USE_MOCK=false`, all `FIREBASE_*` provided
- [ ] `ENFORCE_APP_CHECK=true`, App Check providers registered
- [ ] Privacy + Terms pages live at the configured URLs
- [ ] Entitlement path (A/B) verified: sandbox purchase → premium unlocks →
      breakdown + restyle appear
- [ ] `firebase deploy` done; `flutter test` + functions `npm test` green in CI
- [ ] Crashlytics receiving events; Analytics funnel visible
