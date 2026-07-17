import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/analysis/analyzing_screen.dart';
import '../../features/capture/home_screen.dart';
import '../../features/paywall/paywall_screen.dart';
import '../../features/result/result_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        pageBuilder: (_, __) => const NoTransitionPage(child: HomeScreen()),
      ),
      GoRoute(
        path: '/analyzing',
        pageBuilder: (_, state) =>
            _fade(const AnalyzingScreen(), state.pageKey),
      ),
      GoRoute(
        path: '/result',
        pageBuilder: (_, state) => _fade(const ResultScreen(), state.pageKey),
      ),
      GoRoute(
        path: '/paywall',
        pageBuilder: (_, state) => CustomTransitionPage(
          key: state.pageKey,
          fullscreenDialog: true,
          transitionsBuilder: (_, animation, __, child) => SlideTransition(
            position: Tween(
              begin: const Offset(0, 1),
              end: Offset.zero,
            ).animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
            ),
            child: child,
          ),
          child: const PaywallScreen(),
        ),
      ),
    ],
  );
});

CustomTransitionPage<void> _fade(Widget child, LocalKey key) {
  return CustomTransitionPage(
    key: key,
    transitionDuration: const Duration(milliseconds: 420),
    transitionsBuilder: (_, animation, __, c) =>
        FadeTransition(opacity: animation, child: c),
    child: child,
  );
}
