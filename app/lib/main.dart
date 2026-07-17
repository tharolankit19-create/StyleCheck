import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/providers.dart';
import 'core/theme/app_theme.dart';
import 'data/services/firebase_init.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(AppTheme.overlayStyle);
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  // Decide whether we run against the real backend or the offline mock.
  var mock = AppConfig.useMock;
  if (!mock) {
    final ok = await FirebaseInit.ensureInitialized();
    if (!ok) {
      // Requested live mode but no Firebase config was provided — fall back to
      // mock so the app still runs instead of crashing on first call.
      debugPrint('StyleCheck: no Firebase config; falling back to mock mode.');
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
