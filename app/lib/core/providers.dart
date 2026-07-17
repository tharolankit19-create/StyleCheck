import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/services/analysis_service.dart';
import '../data/services/auth_service.dart';
import '../data/services/live_analysis_service.dart';
import '../data/services/mock_analysis_service.dart';
import '../data/services/purchases_service.dart';
import 'config/app_config.dart';

/// Whether the app is running the offline mock stack. Overridden at bootstrap
/// when the real backend isn't available even though USE_MOCK was false.
final mockModeProvider = Provider<bool>((_) => AppConfig.useMock);

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(mock: ref.watch(mockModeProvider));
});

final purchasesServiceProvider = Provider<PurchasesService>((ref) {
  return ref.watch(mockModeProvider)
      ? MockPurchasesService()
      : LivePurchasesService();
});

final analysisServiceProvider = Provider<AnalysisService>((ref) {
  if (ref.watch(mockModeProvider)) return MockAnalysisService();
  return LiveAnalysisService(auth: ref.watch(authServiceProvider));
});

/// Live premium entitlement flag, mirrored from RevenueCat's customer info.
final premiumProvider =
    NotifierProvider<PremiumNotifier, bool>(PremiumNotifier.new);

class PremiumNotifier extends Notifier<bool> {
  VoidCallback? _detach;

  @override
  bool build() {
    final purchases = ref.watch(purchasesServiceProvider);
    void listener() => state = purchases.premium.value;
    purchases.premium.addListener(listener);
    _detach = () => purchases.premium.removeListener(listener);
    ref.onDispose(() => _detach?.call());
    return purchases.premium.value;
  }
}
