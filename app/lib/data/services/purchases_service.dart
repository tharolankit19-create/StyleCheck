import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:purchases_flutter/purchases_flutter.dart';

import '../../core/config/app_config.dart';
import '../../core/error/failures.dart';

/// A store product simplified for the paywall UI.
@immutable
class PlanOption {
  const PlanOption({
    required this.id,
    required this.title,
    required this.priceString,
    required this.period,
    required this.highlight,
    this.subtitle,
    this.rawPackage,
  });

  final String id;
  final String title; // e.g. "Annual"
  final String priceString; // localized, e.g. "$39.99"
  final String period; // e.g. "/ year"
  final bool highlight; // the recommended plan
  final String? subtitle; // e.g. "3-day free trial · billed yearly"
  final Package? rawPackage;
}

/// Wraps RevenueCat. [premium] is a live-updating flag the whole app listens to.
abstract interface class PurchasesService {
  ValueListenable<bool> get premium;
  Future<void> configure(String appUserId);
  Future<List<PlanOption>> loadPlans();
  Future<bool> purchase(PlanOption plan);
  Future<bool> restore();
}

class LivePurchasesService implements PurchasesService {
  final ValueNotifier<bool> _premium = ValueNotifier(false);
  bool _configured = false;

  @override
  ValueListenable<bool> get premium => _premium;

  @override
  Future<void> configure(String appUserId) async {
    if (_configured) {
      await Purchases.logIn(appUserId);
      return;
    }
    await Purchases.setLogLevel(LogLevel.warn);
    await Purchases.configure(
      PurchasesConfiguration(AppConfig.revenueCatApiKey)
        ..appUserID = appUserId,
    );
    _configured = true;

    Purchases.addCustomerInfoUpdateListener((info) {
      _premium.value =
          info.entitlements.active.containsKey(AppConfig.premiumEntitlement);
    });
    // Seed initial state.
    try {
      final info = await Purchases.getCustomerInfo();
      _premium.value =
          info.entitlements.active.containsKey(AppConfig.premiumEntitlement);
    } catch (_) {/* non-fatal; listener will update */}
  }

  @override
  Future<List<PlanOption>> loadPlans() async {
    try {
      final offerings = await Purchases.getOfferings();
      final current = offerings.current;
      if (current == null || current.availablePackages.isEmpty) return [];

      // Highlight the annual package if present, else the first.
      final annual = current.availablePackages.firstWhere(
        (p) => p.packageType == PackageType.annual,
        orElse: () => current.availablePackages.first,
      );

      return current.availablePackages.map((p) {
        final product = p.storeProduct;
        final isAnnual = p.packageType == PackageType.annual;
        final hasTrial = product.introductoryPrice != null;
        return PlanOption(
          id: p.identifier,
          title: _titleFor(p.packageType),
          priceString: product.priceString,
          period: _periodFor(p.packageType),
          highlight: p.identifier == annual.identifier,
          subtitle: hasTrial
              ? '3-day free trial · then ${product.priceString}'
              : (isAnnual ? 'Best value · billed yearly' : null),
          rawPackage: p,
        );
      }).toList()
        ..sort((a, b) => (a.highlight ? 0 : 1).compareTo(b.highlight ? 0 : 1));
    } on PlatformException catch (_) {
      throw const PurchaseFailure("Couldn't load plans. Try again.");
    }
  }

  @override
  Future<bool> purchase(PlanOption plan) async {
    final pkg = plan.rawPackage;
    if (pkg == null) throw const PurchaseFailure('Plan unavailable.');
    try {
      final info = await Purchases.purchasePackage(pkg);
      final unlocked =
          info.entitlements.active.containsKey(AppConfig.premiumEntitlement);
      _premium.value = unlocked;
      return unlocked;
    } on PlatformException catch (e) {
      final code = PurchasesErrorHelper.getErrorCode(e);
      if (code == PurchasesErrorCode.purchaseCancelledError) return false;
      throw PurchaseFailure(_message(code));
    }
  }

  @override
  Future<bool> restore() async {
    try {
      final info = await Purchases.restorePurchases();
      final unlocked =
          info.entitlements.active.containsKey(AppConfig.premiumEntitlement);
      _premium.value = unlocked;
      return unlocked;
    } on PlatformException catch (_) {
      throw const PurchaseFailure("Couldn't restore purchases.");
    }
  }

  String _titleFor(PackageType t) => switch (t) {
        PackageType.annual => 'Annual',
        PackageType.monthly => 'Monthly',
        PackageType.weekly => 'Weekly',
        PackageType.lifetime => 'Lifetime',
        _ => 'Premium',
      };

  String _periodFor(PackageType t) => switch (t) {
        PackageType.annual => '/ year',
        PackageType.monthly => '/ month',
        PackageType.weekly => '/ week',
        _ => '',
      };

  String _message(PurchasesErrorCode code) => switch (code) {
        PurchasesErrorCode.networkError => "You're offline. Try again.",
        PurchasesErrorCode.paymentPendingError => 'Payment is pending approval.',
        PurchasesErrorCode.productAlreadyPurchasedError =>
          'Already purchased — try Restore.',
        _ => "Purchase didn't go through. Try again.",
      };
}

/// Offline paywall for demos: exposes fake plans and flips premium on "purchase".
class MockPurchasesService implements PurchasesService {
  final ValueNotifier<bool> _premium = ValueNotifier(false);

  @override
  ValueListenable<bool> get premium => _premium;

  @override
  Future<void> configure(String appUserId) async {}

  @override
  Future<List<PlanOption>> loadPlans() async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    return const [
      PlanOption(
        id: 'annual',
        title: 'Annual',
        priceString: r'$39.99',
        period: '/ year',
        highlight: true,
        subtitle: '3-day free trial · then \$39.99/yr',
      ),
      PlanOption(
        id: 'weekly',
        title: 'Weekly',
        priceString: r'$4.99',
        period: '/ week',
        highlight: false,
        subtitle: 'Billed weekly · cancel anytime',
      ),
    ];
  }

  @override
  Future<bool> purchase(PlanOption plan) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    _premium.value = true;
    return true;
  }

  @override
  Future<bool> restore() async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    return _premium.value;
  }
}
