import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// A slow, living gradient wash behind the app — two drifting radial blooms of
/// the brand colors over the near-black canvas. Cheap to render, sets the mood.
class AuroraBackground extends StatefulWidget {
  const AuroraBackground({
    super.key,
    required this.child,
    this.intensity = 1.0,
    this.tint,
  });

  final Widget child;

  /// Scales bloom opacity. The result screen pushes this up for the reveal.
  final double intensity;

  /// Optionally bias the blooms toward a color (e.g. the score band color).
  final Color? tint;

  @override
  State<AuroraBackground> createState() => _AuroraBackgroundState();
}

class _AuroraBackgroundState extends State<AuroraBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 18),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, _) => CustomPaint(
              painter: _AuroraPainter(
                t: _c.value,
                intensity: widget.intensity,
                tint: widget.tint,
              ),
            ),
          ),
        ),
        widget.child,
      ],
    );
  }
}

class _AuroraPainter extends CustomPainter {
  _AuroraPainter({required this.t, required this.intensity, this.tint});

  final double t;
  final double intensity;
  final Color? tint;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = AppColors.ink);

    final a = 2 * math.pi * t;
    _bloom(
      canvas,
      size,
      center: Offset(
        size.width * (0.28 + 0.12 * math.cos(a)),
        size.height * (0.22 + 0.08 * math.sin(a)),
      ),
      color: tint ?? AppColors.magenta,
      radius: size.width * 0.9,
      opacity: 0.32 * intensity,
    );
    _bloom(
      canvas,
      size,
      center: Offset(
        size.width * (0.78 + 0.1 * math.sin(a * 0.8)),
        size.height * (0.34 + 0.1 * math.cos(a * 0.8)),
      ),
      color: AppColors.violet,
      radius: size.width * 0.85,
      opacity: 0.28 * intensity,
    );
    _bloom(
      canvas,
      size,
      center: Offset(
        size.width * (0.5 + 0.14 * math.cos(a * 0.6)),
        size.height * (0.85 + 0.05 * math.sin(a * 0.6)),
      ),
      color: (tint != null)
          ? Color.lerp(tint!, AppColors.cyan, 0.4)!
          : AppColors.cyan,
      radius: size.width * 0.7,
      opacity: 0.16 * intensity,
    );
  }

  void _bloom(Canvas canvas, Size size,
      {required Offset center,
      required Color color,
      required double radius,
      required double opacity}) {
    final paint = Paint()
      ..shader = RadialGradient(
        colors: [color.withValues(alpha: opacity), color.withValues(alpha: 0)],
      ).createShader(Rect.fromCircle(center: center, radius: radius));
    canvas.drawCircle(center, radius, paint);
  }

  @override
  bool shouldRepaint(_AuroraPainter old) =>
      old.t != t || old.intensity != intensity || old.tint != tint;
}
