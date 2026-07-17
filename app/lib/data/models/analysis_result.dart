import 'package:flutter/foundation.dart';

/// One line of the premium score breakdown.
@immutable
class BreakdownItem {
  const BreakdownItem({
    required this.label,
    required this.value,
    required this.weight,
    required this.note,
  });

  final String label;
  final int value; // 0-100
  final double weight; // 0-1
  final String note;

  factory BreakdownItem.fromMap(Map<String, dynamic> m) => BreakdownItem(
        label: m['label'] as String? ?? '',
        value: (m['value'] as num?)?.toInt() ?? 0,
        weight: (m['weight'] as num?)?.toDouble() ?? 0,
        note: m['note'] as String? ?? '',
      );
}

/// The result of analyzing one outfit photo. Free fields are always present;
/// [breakdown] is only populated for premium users.
@immutable
class AnalysisResult {
  const AnalysisResult({
    required this.imageSha256,
    required this.score,
    required this.critique,
    required this.category,
    required this.isPremiumUnlocked,
    this.breakdown = const [],
    this.weakestDimension,
    this.localImagePath,
    this.restyleUrl,
  });

  final String imageSha256;
  final double score;
  final String critique;
  final String category;
  final bool isPremiumUnlocked;
  final List<BreakdownItem> breakdown;
  final String? weakestDimension;

  /// Local path to the source photo (for display without re-downloading).
  final String? localImagePath;

  /// URL of the generated "better outfit" image, once produced.
  final String? restyleUrl;

  factory AnalysisResult.fromMap(
    Map<String, dynamic> m, {
    String? localImagePath,
  }) {
    return AnalysisResult(
      imageSha256: m['imageSha256'] as String? ?? '',
      score: (m['score'] as num?)?.toDouble() ?? 0,
      critique: m['critique'] as String? ?? '',
      category: m['category'] as String? ?? 'Unclassified',
      isPremiumUnlocked: m['isPremiumUnlocked'] as bool? ?? false,
      breakdown: ((m['breakdown'] as List?) ?? [])
          .map((e) => BreakdownItem.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList(),
      weakestDimension: m['weakestDimension'] as String?,
      localImagePath: localImagePath,
    );
  }

  AnalysisResult copyWith({
    bool? isPremiumUnlocked,
    List<BreakdownItem>? breakdown,
    String? restyleUrl,
  }) {
    return AnalysisResult(
      imageSha256: imageSha256,
      score: score,
      critique: critique,
      category: category,
      isPremiumUnlocked: isPremiumUnlocked ?? this.isPremiumUnlocked,
      breakdown: breakdown ?? this.breakdown,
      weakestDimension: weakestDimension,
      localImagePath: localImagePath,
      restyleUrl: restyleUrl ?? this.restyleUrl,
    );
  }
}
