import 'package:firebase_core/firebase_core.dart';
import '../../core/config/app_config.dart';

/// Builds [FirebaseOptions] from `--dart-define` values rather than a committed
/// `firebase_options.dart`, so nothing project-specific is baked into the repo.
///
/// These values are the *public* Firebase client config (API key here is an
/// identifier, not a secret). Actual secrets live only in Cloud Functions.
class FirebaseInit {
  static FirebaseOptions get _options => FirebaseOptions(
        apiKey: AppConfig.firebaseApiKey,
        appId: AppConfig.firebaseAppId,
        projectId: AppConfig.firebaseProjectId,
        messagingSenderId: AppConfig.firebaseMessagingSenderId,
        storageBucket: AppConfig.firebaseStorageBucket.isNotEmpty
            ? AppConfig.firebaseStorageBucket
            : '${AppConfig.firebaseProjectId}.appspot.com',
        authDomain: AppConfig.firebaseAuthDomain.isNotEmpty
            ? AppConfig.firebaseAuthDomain
            : '${AppConfig.firebaseProjectId}.firebaseapp.com',
        iosBundleId: AppConfig.firebaseIosBundleId.isNotEmpty
            ? AppConfig.firebaseIosBundleId
            : null,
      );

  /// Initializes Firebase when real config is present. In mock mode with no
  /// config, this is a no-op so the app still boots for demos.
  static Future<bool> ensureInitialized() async {
    if (!AppConfig.hasFirebaseConfig) return false;
    if (Firebase.apps.isNotEmpty) return true;
    await Firebase.initializeApp(options: _options);
    return true;
  }
}
