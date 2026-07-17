import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/error/failures.dart';
import '../../core/providers.dart';
import '../../data/models/analysis_result.dart';
import '../../data/services/analysis_service.dart';

/// The state machine for the capture → analyze → reveal flow.
sealed class AnalysisFlowState {
  const AnalysisFlowState();
}

class FlowIdle extends AnalysisFlowState {
  const FlowIdle();
}

class FlowAnalyzing extends AnalysisFlowState {
  const FlowAnalyzing(this.stage, this.imageBytes);
  final AnalysisStage stage;
  final Uint8List imageBytes;
}

class FlowDone extends AnalysisFlowState {
  const FlowDone(this.result);
  final AnalysisResult result;
}

class FlowError extends AnalysisFlowState {
  const FlowError(this.failure, this.imageBytes, this.localPath);
  final AppFailure failure;
  final Uint8List imageBytes;
  final String? localPath;
}

final analysisControllerProvider =
    NotifierProvider<AnalysisController, AnalysisFlowState>(
        AnalysisController.new);

class AnalysisController extends Notifier<AnalysisFlowState> {
  @override
  AnalysisFlowState build() => const FlowIdle();

  AnalysisService get _service => ref.read(analysisServiceProvider);

  /// Run the analysis. UI navigates to the loading screen the moment this is
  /// called and to the result when [state] becomes [FlowDone].
  Future<void> analyze(Uint8List bytes, {String? localPath}) async {
    _lastBytes = bytes;
    state = FlowAnalyzing(AnalysisStage.uploading, bytes);
    try {
      final result = await _service.analyze(
        bytes,
        localImagePath: localPath,
        onStage: (stage) {
          state = FlowAnalyzing(stage, bytes);
        },
      );
      // Reflect current premium entitlement into the result.
      final premium = ref.read(premiumProvider);
      state = FlowDone(
        premium ? result.copyWith(isPremiumUnlocked: true) : result,
      );
    } on AppFailure catch (f) {
      state = FlowError(f, bytes, localPath);
    } catch (_) {
      state = FlowError(const UnknownFailure(), bytes, localPath);
    }
  }

  Future<void> retry() async {
    final s = state;
    if (s is FlowError) {
      await analyze(s.imageBytes, localPath: s.localPath);
    }
  }

  /// Called when premium unlocks after a purchase, to refresh the current
  /// result's gated fields (breakdown) via a re-analysis of the cached image.
  Future<void> refreshEntitlement() async {
    final s = state;
    if (s is FlowDone && !s.result.isPremiumUnlocked) {
      // Re-run analyze against the same bytes — the backend now returns the
      // breakdown because the user is premium (and the result is cached, so
      // this is cheap and deterministic).
      final local = s.result.localImagePath;
      final bytes = _lastBytes;
      if (bytes != null) {
        final refreshed = await _service.analyze(bytes, localImagePath: local);
        state = FlowDone(refreshed.copyWith(isPremiumUnlocked: true));
      } else {
        state = FlowDone(s.result.copyWith(isPremiumUnlocked: true));
      }
    }
  }

  Uint8List? _lastBytes;

  void reset() {
    state = const FlowIdle();
  }

  @visibleForTesting
  void setStateForTest(AnalysisFlowState s) => state = s;
}
