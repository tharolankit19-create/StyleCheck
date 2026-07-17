import 'dart:async';
import 'dart:ui' show PlatformDispatcher;
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';

/// Production observability + abuse protection, initialized once at boot.
///
/// - **App Check** attests that calls come from a genuine app build, so the
///   callable Cloud Functions can reject everything else (enable enforcement
///   server-side with ENFORCE_APP_CHECK=true).
/// - **Crashlytics** captures fatal and non-fatal errors.
/// - **Analytics** records the conversion funnel.
///
/// All of this is a no-op when Firebase isn't initialized (mock/demo mode), so
/// the app still boots cleanly with zero backend.
class Observability {
  Observability._();
  static final Observability instance = Observability._();

  FirebaseAnalytics? _analytics;
  bool _enabled = false;

  bool get isEnabled => _enabled;
  FirebaseAnalytics? get analytics => _analytics;

  /// Wire up App Check, Crashlytics and Analytics. Safe to call only after
  /// Firebase.initializeApp has succeeded.
  Future<void> initialize() async {
    try {
      await FirebaseAppCheck.instance.activate(
        // Debug providers in debug builds; hardware attestation in release.
        androidProvider:
            kDebugMode ? AndroidProvider.debug : AndroidProvider.playIntegrity,
        appleProvider:
            kDebugMode ? AppleProvider.debug : AppleProvider.appAttest,
      );

      final crashlytics = FirebaseCrashlytics.instance;
      await crashlytics.setCrashlyticsCollectionEnabled(!kDebugMode);

      // Route Flutter framework + platform errors into Crashlytics.
      FlutterError.onError = (details) {
        FlutterError.presentError(details);
        crashlytics.recordFlutterError(details);
      };
      PlatformDispatcher.instance.onError = (error, stack) {
        crashlytics.recordError(error, stack, fatal: true);
        return true;
      };

      _analytics = FirebaseAnalytics.instance;
      _enabled = true;
    } catch (e, s) {
      debugPrint('Observability init skipped: $e');
      debugPrintStack(stackTrace: s);
    }
  }

  /// Fire-and-forget analytics event.
  void log(String name, [Map<String, Object>? params]) {
    _analytics?.logEvent(name: name, parameters: params);
  }

  /// Record a handled (non-fatal) error for later triage.
  void recordError(Object error, StackTrace? stack, {String? reason}) {
    if (!_enabled) return;
    FirebaseCrashlytics.instance
        .recordError(error, stack, reason: reason, fatal: false);
  }
}
