import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/error/failures.dart';
import '../../core/providers.dart';

/// State of the "generate a better outfit" call.
sealed class RestyleState {
  const RestyleState();
}

class RestyleIdle extends RestyleState {
  const RestyleIdle();
}

class RestyleLoading extends RestyleState {
  const RestyleLoading();
}

class RestyleReady extends RestyleState {
  const RestyleReady(this.imageUrl);
  final String imageUrl; // may be a mock:// url in demo mode
}

class RestyleFailed extends RestyleState {
  const RestyleFailed(this.message);
  final String message;
}

final restyleControllerProvider =
    NotifierProvider<RestyleController, RestyleState>(RestyleController.new);

class RestyleController extends Notifier<RestyleState> {
  @override
  RestyleState build() => const RestyleIdle();

  Future<void> generate(String imageSha256) async {
    if (state is RestyleLoading) return;
    state = const RestyleLoading();
    try {
      final url =
          await ref.read(analysisServiceProvider).generateBetterOutfit(imageSha256);
      state = RestyleReady(url);
    } on AppFailure catch (f) {
      state = RestyleFailed(f.message);
    } catch (_) {
      state = const RestyleFailed('Something went wrong generating the restyle.');
    }
  }

  void reset() => state = const RestyleIdle();

  @visibleForTesting
  void setForTest(RestyleState s) => state = s;
}
