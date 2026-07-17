import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/aurora_background.dart';
import '../../core/widgets/gradient_button.dart';
import '../../data/models/analysis_result.dart';
import '../analysis/analysis_controller.dart';
import '../premium/premium_section.dart';
import '../premium/restyle_controller.dart';
import 'widgets/score_gauge.dart';

class ResultScreen extends ConsumerStatefulWidget {
  const ResultScreen({super.key});

  @override
  ConsumerState<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends ConsumerState<ResultScreen> {
  bool _revealed = false;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(analysisControllerProvider);

    // When premium flips on (e.g. after a purchase), refresh the gated fields.
    ref.listen(premiumProvider, (prev, next) {
      if (next == true) {
        ref.read(analysisControllerProvider.notifier).refreshEntitlement();
      }
    });

    if (state is! FlowDone) {
      // Defensive: nothing to show — go home.
      return const _EmptyResult();
    }
    final result = state.result;
    final band = AppColors.forScore(result.score);

    return Scaffold(
      body: AuroraBackground(
        intensity: 1.3,
        tint: band,
        child: SafeArea(
          child: Column(
            children: [
              _TopBar(
                onClose: () {
                  ref.read(restyleControllerProvider.notifier).reset();
                  ref.read(analysisControllerProvider.notifier).reset();
                  context.go('/');
                },
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(
                      Insets.lg, 0, Insets.lg, Insets.xl),
                  child: Column(
                    children: [
                      const SizedBox(height: Insets.md),
                      ScoreGauge(
                        score: result.score,
                        onRevealComplete: () =>
                            setState(() => _revealed = true),
                      ),
                      const SizedBox(height: Insets.xl),
                      if (_revealed) ...[
                        _CategoryChip(category: result.category)
                            .animate()
                            .fadeIn(duration: 400.ms)
                            .scale(begin: const Offset(0.8, 0.8)),
                        const SizedBox(height: Insets.lg),
                        _CritiqueCard(text: result.critique)
                            .animate()
                            .fadeIn(delay: 150.ms, duration: 500.ms)
                            .slideY(begin: 0.2, curve: Curves.easeOutCubic),
                        const SizedBox(height: Insets.xl),
                        if (result.localImagePath != null) ...[
                          _SourceThumb(path: result.localImagePath!),
                          const SizedBox(height: Insets.xl),
                        ],
                        PremiumSection(result: result)
                            .animate()
                            .fadeIn(delay: 300.ms, duration: 500.ms),
                        const SizedBox(height: Insets.xl),
                        GradientButton(
                          label: 'Check another fit',
                          icon: Icons.add_a_photo_rounded,
                          gradient: const LinearGradient(colors: [
                            AppColors.surfaceHigh,
                            AppColors.surfaceHigh,
                          ]),
                          onPressed: () {
                            ref
                                .read(restyleControllerProvider.notifier)
                                .reset();
                            ref
                                .read(analysisControllerProvider.notifier)
                                .reset();
                            context.go('/');
                          },
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onClose});
  final VoidCallback onClose;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Insets.sm, vertical: 4),
      child: Row(
        children: [
          IconButton(
            onPressed: onClose,
            icon: const Icon(Icons.close_rounded, color: AppColors.textPrimary),
          ),
          const Spacer(),
          Text('YOUR VERDICT', style: AppType.overline),
          const Spacer(),
          const SizedBox(width: 48),
        ],
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.category});
  final String category;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Insets.md, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.lime.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(Radii.pill),
        border: Border.all(color: AppColors.lime.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.style_rounded, size: 16, color: AppColors.lime),
          const SizedBox(width: 8),
          Text(
            category.toUpperCase(),
            style: AppType.label.copyWith(
                color: AppColors.lime, letterSpacing: 1.2),
          ),
        ],
      ),
    );
  }
}

class _CritiqueCard extends StatelessWidget {
  const _CritiqueCard({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(Insets.lg),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: AppColors.stroke),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('THE ONE-LINER', style: AppType.overline),
          const SizedBox(height: Insets.sm),
          Text(
            '“$text”',
            style: AppType.display.copyWith(fontSize: 24, height: 1.25),
          ),
        ],
      ),
    );
  }
}

class _SourceThumb extends StatelessWidget {
  const _SourceThumb({required this.path});
  final String path;
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(Radii.lg),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 220),
        child: Image.file(File(path), fit: BoxFit.cover, width: double.infinity),
      ),
    );
  }
}

class _EmptyResult extends StatelessWidget {
  const _EmptyResult();
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: TextButton(
          onPressed: () => context.go('/'),
          child: Text('Start a new check', style: AppType.title),
        ),
      ),
    );
  }
}
