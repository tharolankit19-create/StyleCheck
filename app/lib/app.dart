import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/providers.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class StyleCheckApp extends ConsumerStatefulWidget {
  const StyleCheckApp({super.key});

  @override
  ConsumerState<StyleCheckApp> createState() => _StyleCheckAppState();
}

class _StyleCheckAppState extends ConsumerState<StyleCheckApp> {
  @override
  void initState() {
    super.initState();
    // Establish the anonymous session and configure RevenueCat up front so the
    // paywall and gating are ready before the user reaches them.
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrapSession());
  }

  Future<void> _bootstrapSession() async {
    try {
      final uid = await ref.read(authServiceProvider).ensureSignedIn();
      final purchases = ref.read(purchasesServiceProvider);
      if (uid.isNotEmpty) {
        await purchases.configure(uid);
      }
    } catch (_) {
      // Non-fatal: the flow will re-attempt sign-in when the user analyzes.
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'StyleCheck',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      routerConfig: router,
    );
  }
}
