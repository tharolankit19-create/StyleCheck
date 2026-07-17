import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:purchases_ui_flutter/purchases_ui_flutter.dart';

import '../../core/config/app_config.dart';
import '../../core/providers.dart';

/// Single entry point for showing the paywall and managing subscriptions.
///
/// In live mode it uses RevenueCat's prebuilt, dashboard-configured
/// [RevenueCatUI] Paywall and Customer Center — the modern, recommended path.
/// In mock mode (or if a native paywall can't be presented) it falls back to
/// the in-app custom paywall at `/paywall`.
abstract final class PaywallLauncher {
  /// Present the paywall. Returns true if the user is entitled afterward.
  ///
  /// Uses `presentPaywallIfNeeded` so a user who already has "StyleCheck Pro"
  /// is never shown the paywall.
  static Future<bool> present(BuildContext context, WidgetRef ref) async {
    final purchases = ref.read(purchasesServiceProvider);

    if (!ref.read(revenueCatLiveProvider)) {
      return _customFallback(context, ref);
    }

    try {
      final result = await RevenueCatUI.presentPaywallIfNeeded(
        AppConfig.premiumEntitlement,
        displayCloseButton: true,
      );
      // Reconcile local state (the update listener usually beat us here).
      await purchases.refresh();
      final entitled = ref.read(premiumProvider);
      return entitled ||
          result == PaywallResult.purchased ||
          result == PaywallResult.restored;
    } catch (_) {
      // No native paywall configured / SDK not ready → in-app fallback.
      if (!context.mounted) return ref.read(premiumProvider);
      return _customFallback(context, ref);
    }
  }

  /// Present RevenueCat's Customer Center so users can manage, cancel, restore,
  /// request refunds, etc. Live builds only.
  static Future<void> presentCustomerCenter(
    BuildContext context,
    WidgetRef ref,
  ) async {
    if (!ref.read(revenueCatLiveProvider)) {
      _snack(context, 'Subscription management opens in live builds.');
      return;
    }
    try {
      await RevenueCatUI.presentCustomerCenter();
      await ref.read(purchasesServiceProvider).refresh();
    } catch (_) {
      if (context.mounted) {
        _snack(context, "Couldn't open subscription management.");
      }
    }
  }

  static Future<bool> _customFallback(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final result = await context.push<bool>('/paywall');
    return result ?? ref.read(premiumProvider);
  }

  static void _snack(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}
