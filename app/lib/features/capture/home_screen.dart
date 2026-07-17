import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/aurora_background.dart';
import '../../core/widgets/gradient_button.dart';
import '../analysis/analysis_controller.dart';
import '../paywall/paywall_launcher.dart';
import 'image_source_sheet.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  Future<void> _startCheck(BuildContext context, WidgetRef ref) async {
    final source = await showImageSourceSheet(context);
    if (source == null) return;

    final picker = ImagePicker();
    final XFile? file = await picker.pickImage(
      source: source,
      maxWidth: 1600,
      imageQuality: 92,
    );
    if (file == null) return;
    final bytes = await file.readAsBytes();

    // Kick off analysis and move to the loading choreography immediately.
    // ignore: use_build_context_synchronously
    if (!context.mounted) return;
    ref.read(analysisControllerProvider.notifier).analyze(
          bytes,
          localPath: file.path,
        );
    context.go('/analyzing');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mock = ref.watch(mockModeProvider);
    final premium = ref.watch(premiumProvider);
    return Scaffold(
      body: AuroraBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: Insets.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: Insets.md),
                Row(
                  children: [
                    const _Wordmark(),
                    const Spacer(),
                    if (premium)
                      IconButton(
                        tooltip: 'Manage subscription',
                        onPressed: () =>
                            PaywallLauncher.presentCustomerCenter(context, ref),
                        icon: const Icon(Icons.manage_accounts_rounded,
                            color: AppColors.textSecondary),
                      ),
                    if (mock) const _DemoBadge(),
                  ],
                ),
                const Spacer(),
                Text('AN HONEST', style: AppType.overline)
                    .animate()
                    .fadeIn(delay: 100.ms, duration: 500.ms)
                    .slideX(begin: -0.1),
                const SizedBox(height: Insets.xs),
                _HeadlineGradient(
                  text: 'SCORE ON\nYOUR FIT.',
                )
                    .animate()
                    .fadeIn(delay: 220.ms, duration: 600.ms)
                    .slideY(begin: 0.12, curve: Curves.easeOutCubic),
                const SizedBox(height: Insets.md),
                Text(
                  'Upload a full-body photo. Get a real number, one ruthless line, and where your look actually lands. No vibes — just what the camera sees.',
                  style: AppType.body,
                )
                    .animate()
                    .fadeIn(delay: 420.ms, duration: 600.ms),
                const Spacer(),
                const _RatingScaleStrip()
                    .animate()
                    .fadeIn(delay: 560.ms, duration: 600.ms),
                const SizedBox(height: Insets.lg),
                GradientButton(
                  label: 'Check my fit',
                  icon: Icons.auto_awesome,
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    _startCheck(context, ref);
                  },
                )
                    .animate()
                    .fadeIn(delay: 680.ms, duration: 500.ms)
                    .slideY(begin: 0.3, curve: Curves.easeOutBack),
                const SizedBox(height: Insets.md),
                Center(
                  child: Text(
                    mock
                        ? 'Demo mode · runs fully offline'
                        : '3 free checks a day · no account needed',
                    style: AppType.caption,
                  ),
                ),
                const SizedBox(height: Insets.lg),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Wordmark extends StatelessWidget {
  const _Wordmark();
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            gradient: AppColors.brand,
            borderRadius: BorderRadius.circular(9),
          ),
          child: const Icon(Icons.bolt, size: 20, color: Colors.white),
        ),
        const SizedBox(width: Insets.sm),
        Text('StyleCheck', style: AppType.headline),
      ],
    );
  }
}

class _HeadlineGradient extends StatelessWidget {
  const _HeadlineGradient({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      shaderCallback: (rect) => AppColors.brandWide.createShader(rect),
      child: Text(
        text,
        style: AppType.displayXL.copyWith(color: Colors.white, fontSize: 52),
      ),
    );
  }
}

class _DemoBadge extends StatelessWidget {
  const _DemoBadge();
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.lime.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(Radii.pill),
        border: Border.all(color: AppColors.lime.withValues(alpha: 0.4)),
      ),
      child: Text(
        'DEMO',
        style: AppType.overline.copyWith(color: AppColors.lime, letterSpacing: 1.4),
      ),
    );
  }
}

/// A little 2–9 scale strip that hints at the score range.
class _RatingScaleStrip extends StatelessWidget {
  const _RatingScaleStrip();
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Insets.md),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: AppColors.stroke),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('THE SCALE', style: AppType.overline),
              const Spacer(),
              Text('2.0 – 9.0', style: AppType.label),
            ],
          ),
          const SizedBox(height: Insets.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(Radii.pill),
            child: Container(
              height: 8,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.scoreBrutal,
                    AppColors.scoreMid,
                    AppColors.scoreElite,
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('tragic', style: AppType.caption),
              Text('mid', style: AppType.caption),
              Text('elite', style: AppType.caption),
            ],
          ),
        ],
      ),
    );
  }
}
