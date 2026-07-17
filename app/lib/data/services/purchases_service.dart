import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:purchases_flutter/purchases_flutter.dart';

import '../../core/config/app_config.dart';
import '../../core/error/failures.dart';

/// A store product simplified for the (fallback / mock) paywall UI.
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

/// A snapshot of the user's premium subscription, derived from RevenueCat's
/// CustomerInfo. Used to display status and drive the Customer Center.
@immutable
class SubscriptionInfo {
  const SubscriptionInfo({
    required this.isActive,
    required this.willRenew,
    this.productIdentifier,
    this.expiresAtIso,
    this.store,
    this.managementUrl,
  });

  final bool isActive;
  final bool willRenew;
  final String? productIdentifier;
  final String? expiresAtIso;
  final String? store; // e.g. "appStore", "playStore"
  final String? managementUrl;
}

/// Wraps the RevenueCat SDK. [premium] is a live-updating flag the whole app
/// listens to (kept in sync by RevenueCat's CustomerInfo update stream).
abstract interface class PurchasesService {
  ValueListenable<bool> get premium;

  /// Configure the SDK and identify the user (uid == RevenueCat app_user_id).
  Future<void> configure(String appUserId);

  /// Re-pull CustomerInfo and refresh [premium].
  Future<void> refresh();

  /// Current subscription snapshot for the premium entitlement, or null.
  Future<SubscriptionInfo?> subscriptionInfo();

  /// Packages from the current offering (used by the fallback/mock paywall).
  Future<List<PlanOption>> loadPlans();

  Future<bool> purchase(PlanOption plan);
  Future<bool> restore();
}

class LivePurchasesService implements PurchasesService {
  final ValueNotifier<bool> _premium = ValueNotifier(false);
  bool _configured = false;

  static String get _entitlement => AppConfig.premiumEntitlement;

  @override
  ValueListenable<bool> get premium => _premium;

  bool _isEntitled(CustomerInfo info) =>
      info.entitlements.active.containsKey(_entitlement);

  @override
  Future<void> configure(String appUserId) async {
    if (AppConfig.revenueCatApiKey.isEmpty) {
      debugPrint('RevenueCat: no API key provided; skipping configure.');
      return;
    }
    if (_configured) {
      await Purchases.logIn(appUserId);
      await refresh();
      return;
    }

    await Purchases.setLogLevel(
      kDebugMode ? LogLevel.debug : LogLevel.warn,
    );
    // Modern configuration: identify the user up front so entitlements and the
    // RevenueCat webhook (which keys on app_user_id == Firebase uid) line up.
    await Purchases.configure(
      PurchasesConfiguration(AppConfig.revenueCatApiKey)..appUserID = appUserId,
    );
    _configured = true;

    // The source of truth for entitlement state: react to every CustomerInfo
    // change (purchase, renewal, expiration, restore) automatically.
    Purchases.addCustomerInfoUpdateListener((info) {
      _premium.value = _isEntitled(info);
    });

    await refresh();
  }

  @override
  Future<void> refresh() async {
    try {
      final info = await Purchases.getCustomerInfo();
      _premium.value = _isEntitled(info);
    } catch (_) {
      // Non-fatal; the update listener will correct state when it can.
    }
  }

  @override
  Future<SubscriptionInfo?> subscriptionInfo() async {
    try {
      final info = await Purchases.getCustomerInfo();
      final ent = info.entitlements.active[_entitlement];
      if (ent == null) return null;
      return SubscriptionInfo(
        isActive: ent.isActive,
        willRenew: ent.willRenew,
        productIdentifier: ent.productIdentifier,
        expiresAtIso: ent.expirationDate,
        store: ent.store.name,
        managementUrl: info.managementURL,
      );
    } catch (_) {
      return null;
    }
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
      final result = await Purchases.purchasePackage(pkg);
      final unlocked = _isEntitled(result);
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
      final unlocked = _isEntitled(info);
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
  Future<void> refresh() async {}

  @override
  Future<SubscriptionInfo?> subscriptionInfo() async {
    if (!_premium.value) return null;
    return SubscriptionInfo(
      isActive: true,
      willRenew: true,
      productIdentifier: 'yearly',
      expiresAtIso:
          DateTime.now().add(const Duration(days: 365)).toIso8601String(),
      store: 'demo',
      managementUrl: null,
    );
  }

  @override
  Future<List<PlanOption>> loadPlans() async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    return const [
      PlanOption(
        id: 'yearly',
        title: 'Annual',
        priceString: r'$39.99',
        period: '/ year',
        highlight: true,
        subtitle: '3-day free trial · then \$39.99/yr',
      ),
      PlanOption(
        id: 'Weekly',
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
