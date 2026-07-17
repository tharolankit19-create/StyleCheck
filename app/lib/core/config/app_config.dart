/// Build-time configuration.
///
/// Everything here is read from `--dart-define` at build time. Nothing secret
/// is committed to the repo. The client never holds a third-party vendor key —
/// only the Firebase client config (which is public by design) and the
/// RevenueCat *public* SDK key.
///
/// Example build:
///   flutter run \
///     --dart-define=FIREBASE_API_KEY=... \
///     --dart-define=FIREBASE_APP_ID=... \
///     --dart-define=FIREBASE_PROJECT_ID=... \
///     --dart-define=FIREBASE_MESSAGING_SENDER_ID=... \
///     --dart-define=FIREBASE_STORAGE_BUCKET=... \
///     --dart-define=REVENUECAT_API_KEY=... \
///     --dart-define=USE_MOCK=false
library;

class AppConfig {
  const AppConfig._();

  // --- Firebase (public client config; safe to ship, still injected at build) ---
  static const firebaseApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const firebaseAppId = String.fromEnvironment('FIREBASE_APP_ID');
  static const firebaseProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const firebaseMessagingSenderId =
      String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const firebaseStorageBucket =
      String.fromEnvironment('FIREBASE_STORAGE_BUCKET');
  static const firebaseAuthDomain =
      String.fromEnvironment('FIREBASE_AUTH_DOMAIN');
  // iOS needs the client id / bundle id for the GoogleService plist equivalent.
  static const firebaseIosBundleId =
      String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID');

  // --- RevenueCat public SDK key (platform-specific) ---
  static const revenueCatApiKey = String.fromEnvironment('REVENUECAT_API_KEY');

  /// Entitlement id that unlocks premium — must match RevenueCat + Functions.
  static const premiumEntitlement = 'premium';

  /// Region the callable functions are deployed to.
  static const functionsRegion = 'us-central1';

  // --- Mock/demo mode ---
  // When true, the app returns deterministic fake analysis + a placeholder
  // restyle image, so the entire flow runs with zero backend/keys. Defaults to
  // true in debug convenience, but release builds should pass USE_MOCK=false.
  static const useMock = bool.fromEnvironment('USE_MOCK', defaultValue: true);

  /// True only when the minimum Firebase config is present.
  static bool get hasFirebaseConfig =>
      firebaseApiKey.isNotEmpty &&
      firebaseAppId.isNotEmpty &&
      firebaseProjectId.isNotEmpty;

  static bool get hasRevenueCat => revenueCatApiKey.isNotEmpty;
}
