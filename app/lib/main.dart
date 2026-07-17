import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/providers.dart';
import 'core/theme/app_theme.dart';
import 'data/services/firebase_init.dart';
import 'data/services/observability.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(AppTheme.overlayStyle);
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  // Decide whether we run against the real backend or the offline mock.
  var mock = AppConfig.useMock;
  if (!mock) {
    final ok = await FirebaseInit.ensureInitialized();
    if (ok) {
      // Production observability + abuse protection (App Check, Crashlytics,
      // Analytics). No-op if it can't initialize.
      await Observability.instance.initialize();
    } else {
      // Requested live mode but no Firebase config was provided. In debug this
      // is a convenience fallback so the app still runs; in release it signals
      // a misconfigured build.
      assert(() {
        debugPrint('StyleCheck: no Firebase config; falling back to mock mode.');
        return true;
      }());
      mock = true;
    }
  }

  runApp(
    ProviderScope(
      overrides: [mockModeProvider.overrideWithValue(mock)],
      child: const StyleCheckApp(),
    ),
  );
}
