import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';

/// The score reveal — the emotional peak of the app.
///
/// A gradient arc sweeps from empty to the score while the big number counts up
/// in sync. It settles with a spring, punches a haptic at the crescendo, and
/// pulses a glow in the score's band color.
class ScoreGauge extends StatefulWidget {
  const ScoreGauge({
    super.key,
    required this.score,
    this.size = 280,
    this.onRevealComplete,
  });

  final double score; // 2.0 - 9.0
  final double size;
  final VoidCallback? onRevealComplete;

  @override
  State<ScoreGauge> createState() => _ScoreGaugeState();
}

class _ScoreGaugeState extends State<ScoreGauge>
    with TickerProviderStateMixin {
  late final AnimationController _sweep = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1700),
  );
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  );

  late final Animation<double> _t = CurvedAnimation(
    parent: _sweep,
    curve: Curves.easeOutCubic,
  );

  bool _punched = false;

  @override
  void initState() {
    super.initState();
    // A beat of anticipation, then the reveal.
    Future.delayed(const Duration(milliseconds: 350), () {
      if (mounted) _sweep.forward();
    });
    _sweep.addListener(_maybeHaptic);
    _sweep.addStatusListener((s) {
      if (s == AnimationStatus.completed) {
        _pulse.repeat(reverse: true);
        widget.onRevealComplete?.call();
      }
    });
  }

  void _maybeHaptic() {
    // Land a solid tap right as the number settles.
    if (!_punched && _sweep.value > 0.86) {
      _punched = true;
      HapticFeedback.heavyImpact();
    }
  }

  @override
  void dispose() {
    _sweep.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final band = AppColors.forScore(widget.score);
    return AnimatedBuilder(
      animation: Listenable.merge([_sweep, _pulse]),
      builder: (context, _) {
        final t = _t.value;
        final displayed = widget.score * t;
        final glow = 0.4 + 0.6 * _pulse.value;
        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Band glow behind the ring.
              Container(
                width: widget.size * 0.82,
                height: widget.size * 0.82,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: band.withValues(alpha: 0.35 * glow * t),
                      blurRadius: 60,
                      spreadRadius: 8,
                    ),
                  ],
                ),
              ),
              CustomPaint(
                size: Size.square(widget.size),
                painter: _GaugePainter(
                  progress: t * (widget.score / 9.0),
                  score: widget.score,
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    displayed.toStringAsFixed(1),
                    style: AppType.scoreDigits.copyWith(
                      color: Colors.white,
                      shadows: [
                        Shadow(color: band.withValues(alpha: 0.7 * t), blurRadius: 28),
                      ],
                    ),
                  ),
                  Text('OUT OF 9.0', style: AppType.overline),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

class _GaugePainter extends CustomPainter {
  _GaugePainter({required this.progress, required this.score});

  final double progress; // 0-1 fraction of the full ring
  final double score;

  static const _start = math.pi * 0.75; // start at lower-left
  static const _sweepMax = math.pi * 1.5; // 270° arc

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.width / 2 - 14;
    final rect = Rect.fromCircle(center: center, radius: radius);

    // Track.
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 16
      ..strokeCap = StrokeCap.round
      ..color = AppColors.stroke;
    canvas.drawArc(rect, _start, _sweepMax, false, track);

    // Progress arc with the band gradient.
    final sweep = _sweepMax * progress.clamp(0.0, 1.0);
    final grad = SweepGradient(
      startAngle: _start,
      endAngle: _start + _sweepMax,
      colors: [
        AppColors.forScore(2.0),
        AppColors.forScore(5.0),
        AppColors.forScore(9.0),
      ],
      stops: const [0.0, 0.5, 1.0],
    );
    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 16
      ..strokeCap = StrokeCap.round
      ..shader = grad.createShader(rect);
    canvas.drawArc(rect, _start, sweep, false, arc);

    // Leading tick dot.
    if (progress > 0.01) {
      final angle = _start + sweep;
      final dot = Offset(
        center.dx + radius * math.cos(angle),
        center.dy + radius * math.sin(angle),
      );
      canvas.drawCircle(dot, 11, Paint()..color = Colors.white);
      canvas.drawCircle(
        dot,
        6,
        Paint()..color = AppColors.forScore(score),
      );
    }
  }

  @override
  bool shouldRepaint(_GaugePainter old) => old.progress != progress;
}
