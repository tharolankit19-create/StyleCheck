import 'dart:ui';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/gradient_button.dart';
import '../../data/models/analysis_result.dart';
import '../paywall/paywall_launcher.dart';
import 'restyle_controller.dart';

/// The premium block on the result screen: the detailed breakdown and the
/// AI restyle. Locked behind a teaser for free users; fully interactive once
/// the premium entitlement is active.
class PremiumSection extends ConsumerWidget {
  const PremiumSection({super.key, required this.result});
  final AnalysisResult result;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!result.isPremiumUnlocked) {
      return _LockedTeaser(result: result);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(icon: Icons.insights_rounded, title: 'The breakdown'),
        const SizedBox(height: Insets.md),
        ...result.breakdown.map((b) => _BreakdownBar(item: b)),
        const SizedBox(height: Insets.xl),
        _SectionHeader(
          icon: Icons.auto_fix_high_rounded,
          title: 'Your fit, leveled up',
        ),
        const SizedBox(height: Insets.md),
        _RestylePanel(result: result),
        const SizedBox(height: Insets.lg),
        Center(
          child: GhostButton(
            label: 'Manage subscription',
            icon: Icons.card_membership_rounded,
            onPressed: () => PaywallLauncher.presentCustomerCenter(context, ref),
          ),
        ),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.icon, required this.title});
  final IconData icon;
  final String title;
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.lime),
        const SizedBox(width: Insets.sm),
        Text(title, style: AppType.headline),
      ],
    );
  }
}

class _BreakdownBar extends StatelessWidget {
  const _BreakdownBar({required this.item});
  final BreakdownItem item;

  @override
  Widget build(BuildContext context) {
    final color = AppColors.forScore(item.value / 100 * 9);
    return Padding(
      padding: const EdgeInsets.only(bottom: Insets.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(item.label, style: AppType.bodyStrong),
              const Spacer(),
              Text('${item.value}',
                  style: AppType.title.copyWith(color: color)),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(Radii.pill),
            child: Stack(
              children: [
                Container(height: 10, color: AppColors.surfaceHigh),
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: item.value / 100),
                  duration: const Duration(milliseconds: 900),
                  curve: Curves.easeOutCubic,
                  builder: (context, v, _) => FractionallySizedBox(
                    widthFactor: v,
                    child: Container(
                      height: 10,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [color.withValues(alpha: 0.7), color],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(item.note, style: AppType.caption),
        ],
      ),
    );
  }
}

class _RestylePanel extends ConsumerWidget {
  const _RestylePanel({required this.result});
  final AnalysisResult result;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(restyleControllerProvider);
    return switch (state) {
      RestyleReady(:final imageUrl) => _RestyleImage(url: imageUrl),
      RestyleLoading() => const _RestyleLoading(),
      RestyleFailed(:final message) => _RestyleError(
          message: message,
          onRetry: () => ref
              .read(restyleControllerProvider.notifier)
              .generate(result.imageSha256),
        ),
      _ => _RestyleCta(
          onTap: () => ref
              .read(restyleControllerProvider.notifier)
              .generate(result.imageSha256),
        ),
    };
  }
}

class _RestyleCta extends StatelessWidget {
  const _RestyleCta({required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(Insets.lg),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(Radii.lg),
            border: Border.all(color: AppColors.stroke),
          ),
          child: Column(
            children: [
              const Icon(Icons.checkroom_rounded,
                  size: 40, color: AppColors.lime),
              const SizedBox(height: Insets.sm),
              Text(
                'See the same you, styled better',
                style: AppType.title,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                'We keep your face, pose and setting — and rebuild the outfit into a sharper, better-coordinated look.',
                style: AppType.caption,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
        const SizedBox(height: Insets.md),
        GradientButton(
          label: 'Generate a better fit',
          icon: Icons.auto_awesome,
          gradient: AppColors.brandWide,
          onPressed: onTap,
        ),
      ],
    );
  }
}

class _RestyleLoading extends StatelessWidget {
  const _RestyleLoading();
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 320,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: AppColors.stroke),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: AppColors.lime),
          const SizedBox(height: Insets.md),
          Text('Restyling your fit…', style: AppType.bodyStrong),
          Text('This usually takes ~20 seconds', style: AppType.caption),
        ],
      ),
    );
  }
}

class _RestyleImage extends StatelessWidget {
  const _RestyleImage({required this.url});
  final String url;
  @override
  Widget build(BuildContext context) {
    final isMock = url.startsWith('mock://');
    return ClipRRect(
      borderRadius: BorderRadius.circular(Radii.lg),
      child: AspectRatio(
        aspectRatio: 3 / 4,
        child: isMock
            ? _MockRestyle()
            : CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                placeholder: (_, __) => const _RestyleLoading(),
                errorWidget: (_, __, ___) => const _RestyleError(
                  message: 'Could not load the image.',
                ),
              ),
      ),
    );
  }
}

/// Branded placeholder shown for demo-mode restyles.
class _MockRestyle extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(gradient: AppColors.brand),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.checkroom_rounded, size: 56, color: Colors.white),
            const SizedBox(height: Insets.md),
            Text('Your restyled fit',
                style: AppType.headline.copyWith(color: Colors.white)),
            const SizedBox(height: 4),
            Text('(demo placeholder)',
                style: AppType.caption.copyWith(color: Colors.white70)),
          ],
        ),
      ),
    );
  }
}

class _RestyleError extends StatelessWidget {
  const _RestyleError({required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Insets.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: AppColors.stroke),
      ),
      child: Column(
        children: [
          const Icon(Icons.error_outline_rounded,
              color: AppColors.scoreRough, size: 32),
          const SizedBox(height: Insets.sm),
          Text(message, style: AppType.body, textAlign: TextAlign.center),
          if (onRetry != null) ...[
            const SizedBox(height: Insets.md),
            GhostButton(
                label: 'Try again',
                icon: Icons.refresh_rounded,
                onPressed: onRetry),
          ],
        ],
      ),
    );
  }
}

/// The locked teaser shown to free users: a blurred breakdown + AI-restyle
/// promise with a single upsell CTA into the paywall.
class _LockedTeaser extends StatelessWidget {
  const _LockedTeaser({required this.result});
  final AnalysisResult result;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
            icon: Icons.workspace_premium_rounded, title: 'Go deeper'),
        const SizedBox(height: Insets.md),
        Stack(
          children: [
            // Blurred faux-breakdown behind the lock.
            ImageFiltered(
              imageFilter: ImageFilter.blur(sigmaX: 7, sigmaY: 7),
              child: Column(
                children: const [
                  _FauxBar(label: 'Color Harmony'),
                  _FauxBar(label: 'Formality Match'),
                  _FauxBar(label: 'Fit & Proportion'),
                ],
              ),
            ),
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(Radii.lg),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      AppColors.ink.withValues(alpha: 0.1),
                      AppColors.ink.withValues(alpha: 0.75),
                    ],
                  ),
                ),
                child: const Center(
                  child: Icon(Icons.lock_rounded,
                      color: AppColors.textPrimary, size: 34),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: Insets.lg),
        _UnlockCard(),
      ],
    );
  }
}

class _FauxBar extends StatelessWidget {
  const _FauxBar({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Insets.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppType.bodyStrong),
          const SizedBox(height: 8),
          Container(
            height: 10,
            decoration: BoxDecoration(
              gradient: AppColors.brandWide,
              borderRadius: BorderRadius.circular(Radii.pill),
            ),
          ),
        ],
      ),
    );
  }
}

class _UnlockCard extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(Insets.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.violet.withValues(alpha: 0.18),
            AppColors.magenta.withValues(alpha: 0.10),
          ],
        ),
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: AppColors.violet.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Unlock the full verdict', style: AppType.headline),
          const SizedBox(height: Insets.sm),
          const _Perk(text: 'Score breakdown across 5 style dimensions'),
          const _Perk(text: 'An AI restyle of you in a better outfit'),
          const _Perk(text: 'Unlimited checks, no daily cap'),
          const SizedBox(height: Insets.lg),
          GradientButton(
            label: 'Unlock premium',
            icon: Icons.workspace_premium_rounded,
            onPressed: () => PaywallLauncher.present(context, ref),
          ),
        ],
      ),
    );
  }
}

class _Perk extends StatelessWidget {
  const _Perk({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          const Icon(Icons.check_circle_rounded,
              size: 18, color: AppColors.lime),
          const SizedBox(width: Insets.sm),
          Expanded(child: Text(text, style: AppType.body)),
        ],
      ),
    );
  }
}
