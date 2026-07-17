import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/aurora_background.dart';
import '../../core/widgets/gradient_button.dart';
import '../../data/services/analysis_service.dart';
import 'analysis_controller.dart';

class AnalyzingScreen extends ConsumerWidget {
  const AnalyzingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Navigate away as soon as the flow resolves.
    ref.listen(analysisControllerProvider, (prev, next) {
      if (next is FlowDone) context.go('/result');
    });

    final state = ref.watch(analysisControllerProvider);

    return Scaffold(
      body: AuroraBackground(
        intensity: 1.2,
        child: SafeArea(
          child: switch (state) {
            FlowError(:final failure) => _ErrorView(message: failure.message),
            FlowAnalyzing(:final stage, :final imageBytes) => _LoadingView(
                stage: stage,
                bytes: imageBytes,
              ),
            _ => const Center(
                child: CircularProgressIndicator(color: AppColors.violet),
              ),
          },
        ),
      ),
    );
  }
}

class _LoadingView extends StatelessWidget {
  const _LoadingView({required this.stage, required this.bytes});
  final AnalysisStage stage;
  final Uint8List bytes;

  @override
  Widget build(BuildContext context) {
    final index = AnalysisStage.values.indexOf(stage);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Insets.lg),
      child: Column(
        children: [
          const SizedBox(height: Insets.xl),
          // The photo under a scanning shimmer.
          Expanded(
            child: Center(
              child: _ScanningPreview(bytes: bytes),
            ),
          ),
          const SizedBox(height: Insets.xl),
          Text('ANALYZING', style: AppType.overline),
          const SizedBox(height: Insets.sm),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            child: Text(
              stage.label,
              key: ValueKey(stage),
              style: AppType.headline,
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: Insets.lg),
          _StageDots(active: index, total: AnalysisStage.values.length),
          const SizedBox(height: Insets.xxl),
        ],
      ),
    );
  }
}

class _ScanningPreview extends StatelessWidget {
  const _ScanningPreview({required this.bytes});
  final Uint8List bytes;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(Radii.xl),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            constraints: const BoxConstraints(maxHeight: 420, maxWidth: 320),
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.stroke),
              borderRadius: BorderRadius.circular(Radii.xl),
            ),
            child: Image.memory(bytes, fit: BoxFit.cover),
          ),
          // Scanning sweep.
          Container(
            constraints: const BoxConstraints(maxHeight: 420, maxWidth: 320),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(Radii.xl),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  AppColors.violet.withValues(alpha: 0.0),
                  AppColors.magenta.withValues(alpha: 0.35),
                  AppColors.violet.withValues(alpha: 0.0),
                ],
                stops: const [0.0, 0.5, 1.0],
              ),
            ),
          )
              .animate(onPlay: (c) => c.repeat())
              .slideY(begin: -1, end: 1, duration: 1500.ms, curve: Curves.easeInOut),
        ],
      ),
    );
  }
}

class _StageDots extends StatelessWidget {
  const _StageDots({required this.active, required this.total});
  final int active;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(total, (i) {
        final on = i <= active;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: on ? 26 : 8,
          height: 8,
          decoration: BoxDecoration(
            gradient: on ? AppColors.brand : null,
            color: on ? null : AppColors.stroke,
            borderRadius: BorderRadius.circular(Radii.pill),
          ),
        );
      }),
    );
  }
}

class _ErrorView extends ConsumerWidget {
  const _ErrorView({required this.message});
  final String message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.all(Insets.lg),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.sentiment_dissatisfied_rounded,
              size: 64, color: AppColors.textSecondary),
          const SizedBox(height: Insets.md),
          Text('Hmm.', style: AppType.display),
          const SizedBox(height: Insets.sm),
          Text(message, style: AppType.body, textAlign: TextAlign.center),
          const SizedBox(height: Insets.xl),
          GradientButton(
            label: 'Try again',
            icon: Icons.refresh_rounded,
            onPressed: () => ref.read(analysisControllerProvider.notifier).retry(),
          ),
          const SizedBox(height: Insets.sm),
          GhostButton(
            label: 'Back',
            onPressed: () {
              ref.read(analysisControllerProvider.notifier).reset();
              context.go('/');
            },
          ),
        ],
      ),
    );
  }
}
