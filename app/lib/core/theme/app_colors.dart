import 'package:flutter/material.dart';

/// StyleCheck color language.
///
/// Near-black canvas, off-white ink, one loud signature gradient (magenta →
/// violet) and an acid-lime accent. High contrast on purpose: this app is built
/// to be screenshotted.
abstract final class AppColors {
  // Canvas
  static const ink = Color(0xFF0B0B0F);
  static const inkSoft = Color(0xFF121218);
  static const surface = Color(0xFF17171F);
  static const surfaceHigh = Color(0xFF20202B);
  static const stroke = Color(0xFF2C2C38);

  // Text
  static const textPrimary = Color(0xFFF6F6F9);
  static const textSecondary = Color(0xFFA0A0B2);
  static const textFaint = Color(0xFF6A6A7A);

  // Signature gradient
  static const magenta = Color(0xFFFF2D78);
  static const violet = Color(0xFF8B5CFF);
  static const cyan = Color(0xFF33E1FF);

  // Accent
  static const lime = Color(0xFFC6F94E);

  // Score bands
  static const scoreBrutal = Color(0xFFFF4D5E);
  static const scoreRough = Color(0xFFFF8A3D);
  static const scoreMid = Color(0xFFFFC043);
  static const scoreSolid = Color(0xFF7BE38B);
  static const scoreElite = Color(0xFF00E5C7);

  /// The brand gradient used on CTAs, the score arc, and reveal glows.
  static const brand = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [magenta, violet],
  );

  static const brandWide = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [magenta, violet, cyan],
  );

  /// Maps a 2.0-9.0 score onto its band color, with a smooth blend between bands.
  static Color forScore(double score) {
    final stops = <(double, Color)>[
      (2.0, scoreBrutal),
      (3.5, scoreRough),
      (5.0, scoreMid),
      (6.5, scoreSolid),
      (9.0, scoreElite),
    ];
    for (var i = 0; i < stops.length - 1; i++) {
      final (lo, loC) = stops[i];
      final (hi, hiC) = stops[i + 1];
      if (score <= hi) {
        final t = ((score - lo) / (hi - lo)).clamp(0.0, 1.0);
        return Color.lerp(loC, hiC, t)!;
      }
    }
    return scoreElite;
  }

  /// A two-stop gradient centered on the score's band color, for the reveal ring.
  static LinearGradient gradientForScore(double score) {
    final base = forScore(score);
    final warm = Color.lerp(base, magenta, 0.25)!;
    return LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [warm, base],
    );
  }
}
