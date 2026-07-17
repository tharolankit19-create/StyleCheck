import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/error/failures.dart';
import '../../core/providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/aurora_background.dart';
import '../../core/widgets/gradient_button.dart';
import '../../data/services/purchases_service.dart';

class PaywallScreen extends ConsumerStatefulWidget {
  const PaywallScreen({super.key});

  @override
  ConsumerState<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends ConsumerState<PaywallScreen> {
  List<PlanOption>? _plans;
  PlanOption? _selected;
  String? _loadError;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final plans = await ref.read(purchasesServiceProvider).loadPlans();
      if (!mounted) return;
      setState(() {
        _plans = plans;
        _selected = plans.isEmpty
            ? null
            : plans.firstWhere((p) => p.highlight, orElse: () => plans.first);
      });
    } on AppFailure catch (f) {
      if (mounted) setState(() => _loadError = f.message);
    }
  }

  Future<void> _purchase() async {
    final plan = _selected;
    if (plan == null) return;
    setState(() => _busy = true);
    try {
      final ok = await ref.read(purchasesServiceProvider).purchase(plan);
      if (!mounted) return;
      if (ok) {
        Navigator.of(context).pop(true);
      }
    } on AppFailure catch (f) {
      _snack(f.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _restore() async {
    setState(() => _busy = true);
    try {
      final ok = await ref.read(purchasesServiceProvider).restore();
      if (!mounted) return;
      if (ok) {
        Navigator.of(context).pop(true);
      } else {
        _snack('No active subscription found.');
      }
    } on AppFailure catch (f) {
      _snack(f.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(m)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AuroraBackground(
        intensity: 1.2,
        child: SafeArea(
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: IconButton(
                  onPressed: () => context.pop(),
                  icon: const Icon(Icons.close_rounded,
                      color: AppColors.textSecondary),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: Insets.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('STYLECHECK PREMIUM', style: AppType.overline),
                      const SizedBox(height: Insets.sm),
                      Text('Get the full verdict.',
                          style: AppType.displayXL),
                      const SizedBox(height: Insets.lg),
                      const _Feature(
                          icon: Icons.insights_rounded,
                          title: 'Full score breakdown',
                          subtitle: 'Every dimension, scored and explained.'),
                      const _Feature(
                          icon: Icons.auto_fix_high_rounded,
                          title: 'AI restyle',
                          subtitle: 'See yourself in a better-coordinated fit.'),
                      const _Feature(
                          icon: Icons.all_inclusive_rounded,
                          title: 'Unlimited checks',
                          subtitle: 'No daily cap, ever.'),
                      const SizedBox(height: Insets.xl),
                      if (_loadError != null)
                        _PlansError(message: _loadError!, onRetry: _load)
                      else if (_plans == null)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(Insets.xl),
                            child: CircularProgressIndicator(
                                color: AppColors.violet),
                          ),
                        )
                      else if (_plans!.isEmpty)
                        _PlansError(
                            message: 'No plans available right now.',
                            onRetry: _load)
                      else
                        ..._plans!.map((p) => _PlanCard(
                              plan: p,
                              selected: p.id == _selected?.id,
                              onTap: () => setState(() => _selected = p),
                            )),
                    ],
                  ),
                ),
              ),
              _Footer(
                busy: _busy,
                canPurchase: _selected != null,
                selected: _selected,
                onPurchase: _purchase,
                onRestore: _restore,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Feature extends StatelessWidget {
  const _Feature(
      {required this.icon, required this.title, required this.subtitle});
  final IconData icon;
  final String title;
  final String subtitle;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Insets.md),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.lime.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: Icon(icon, color: AppColors.lime),
          ),
          const SizedBox(width: Insets.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppType.title),
                Text(subtitle, style: AppType.caption),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard(
      {required this.plan, required this.selected, required this.onTap});
  final PlanOption plan;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        margin: const EdgeInsets.only(bottom: Insets.md),
        padding: const EdgeInsets.all(Insets.md),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(Radii.lg),
          border: Border.all(
            color: selected ? AppColors.violet : AppColors.stroke,
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            _Radio(selected: selected),
            const SizedBox(width: Insets.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(plan.title, style: AppType.title),
                      if (plan.highlight) ...[
                        const SizedBox(width: Insets.sm),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            gradient: AppColors.brand,
                            borderRadius: BorderRadius.circular(Radii.pill),
                          ),
                          child: Text('BEST VALUE',
                              style: AppType.overline
                                  .copyWith(color: Colors.white)),
                        ),
                      ],
                    ],
                  ),
                  if (plan.subtitle != null)
                    Text(plan.subtitle!, style: AppType.caption),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(plan.priceString, style: AppType.title),
                Text(plan.period, style: AppType.caption),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Radio extends StatelessWidget {
  const _Radio({required this.selected});
  final bool selected;
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: selected ? AppColors.violet : AppColors.textFaint,
          width: 2,
        ),
        gradient: selected ? AppColors.brand : null,
      ),
      child: selected
          ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
          : null,
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({
    required this.busy,
    required this.canPurchase,
    required this.selected,
    required this.onPurchase,
    required this.onRestore,
  });
  final bool busy;
  final bool canPurchase;
  final PlanOption? selected;
  final VoidCallback onPurchase;
  final VoidCallback onRestore;

  @override
  Widget build(BuildContext context) {
    final trial = selected?.subtitle?.contains('trial') ?? false;
    return Container(
      padding: const EdgeInsets.fromLTRB(Insets.lg, Insets.md, Insets.lg, Insets.md),
      decoration: const BoxDecoration(
        color: AppColors.inkSoft,
        border: Border(top: BorderSide(color: AppColors.stroke)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GradientButton(
            label: trial ? 'Start free trial' : 'Unlock premium',
            busy: busy,
            onPressed: canPurchase ? onPurchase : null,
          ),
          const SizedBox(height: Insets.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextButton(
                onPressed: busy ? null : onRestore,
                child: Text('Restore', style: AppType.caption),
              ),
              Text('·', style: AppType.caption),
              TextButton(
                onPressed: () {},
                child: Text('Terms', style: AppType.caption),
              ),
              Text('·', style: AppType.caption),
              TextButton(
                onPressed: () {},
                child: Text('Privacy', style: AppType.caption),
              ),
            ],
          ),
          Text(
            'Billed through the App Store / Google Play. Cancel anytime.',
            style: AppType.caption,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _PlansError extends StatelessWidget {
  const _PlansError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(message, style: AppType.body, textAlign: TextAlign.center),
        const SizedBox(height: Insets.md),
        GhostButton(
            label: 'Retry', icon: Icons.refresh_rounded, onPressed: onRetry),
      ],
    );
  }
}
