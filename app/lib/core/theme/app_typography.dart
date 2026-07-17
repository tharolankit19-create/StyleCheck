import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// Typography scale. Archivo (expanded, heavy) for display moments — the score,
/// headlines — and Inter for readable body/UI text.
abstract final class AppType {
  static TextStyle _archivo(double size, FontWeight w,
          {double? height, double? spacing, Color? color}) =>
      GoogleFonts.archivo(
        fontSize: size,
        fontWeight: w,
        height: height,
        letterSpacing: spacing,
        color: color ?? AppColors.textPrimary,
      );

  static TextStyle _inter(double size, FontWeight w,
          {double? height, double? spacing, Color? color}) =>
      GoogleFonts.inter(
        fontSize: size,
        fontWeight: w,
        height: height,
        letterSpacing: spacing,
        color: color ?? AppColors.textPrimary,
      );

  /// Enormous number used only for the score reveal.
  static TextStyle get scoreDigits =>
      _archivo(120, FontWeight.w900, height: 0.9, spacing: -4);

  static TextStyle get displayXL =>
      _archivo(40, FontWeight.w800, height: 1.02, spacing: -1.2);
  static TextStyle get display =>
      _archivo(30, FontWeight.w800, height: 1.05, spacing: -0.8);
  static TextStyle get headline =>
      _archivo(22, FontWeight.w700, height: 1.1, spacing: -0.4);

  static TextStyle get title => _inter(18, FontWeight.w700, height: 1.2);
  static TextStyle get body =>
      _inter(15, FontWeight.w500, height: 1.45, color: AppColors.textSecondary);
  static TextStyle get bodyStrong => _inter(15, FontWeight.w600, height: 1.4);
  static TextStyle get label => _inter(13, FontWeight.w600, spacing: 0.2);
  static TextStyle get caption =>
      _inter(12, FontWeight.w500, color: AppColors.textFaint);

  /// Uppercase overline used for category chips and section eyebrows.
  static TextStyle get overline => _inter(
        11.5,
        FontWeight.w700,
        spacing: 1.6,
        color: AppColors.textSecondary,
      );
}
