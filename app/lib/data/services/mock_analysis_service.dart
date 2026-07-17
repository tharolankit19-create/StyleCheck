import 'dart:typed_data';
import 'package:crypto/crypto.dart';

import '../models/analysis_result.dart';
import 'analysis_service.dart';

/// Deterministic offline implementation used when `USE_MOCK=true`.
///
/// It derives a stable score, category and critique purely from the image's
/// SHA-256 — so the same photo always yields the same result, exactly like the
/// real backend contract — and returns a placeholder restyle. No network, no
/// keys, so the whole flow runs and is screenshot-able out of the box.
class MockAnalysisService implements AnalysisService {
  static const _categories = [
    'Streetwear',
    'Smart Casual',
    'Minimalist',
    'Old Money',
    'Athleisure',
    'Y2K',
    'Formalwear',
    'Casual',
  ];

  static const _critiquesByBand = <List<String>>[
    // brutal (2.0-3.4)
    [
      "This fit called in sick and came to work anyway.",
      "Somewhere a mirror is filing a complaint.",
      "You didn't get dressed, you got ambushed by laundry.",
    ],
    // rough (3.5-4.9)
    [
      "There's an outfit in here somewhere, fighting to get out.",
      "You're one decision away from this working. You made the other one.",
      "The vibe is 'ran out of clean options,' and it shows.",
    ],
    // mid (5.0-6.4)
    [
      "Perfectly fine. Nobody's screenshotting 'perfectly fine.'",
      "Safe. Very safe. Witness-protection safe.",
      "You're playing it so safe the fit fell asleep.",
    ],
    // solid (6.5-7.9)
    [
      "Okay, this actually goes. Slightly annoying how easy you made it look.",
      "Real 'she gets ready with the lights on' energy.",
      "Sharp. You clearly checked a mirror and it approved.",
    ],
    // elite (8.0-9.0)
    [
      "Okay, show-off. This is a whole moment.",
      "Effortless, expensive, slightly infuriating. Post it.",
      "You didn't get dressed, you got styled by fate.",
    ],
  ];

  @override
  Future<AnalysisResult> analyze(
    Uint8List bytes, {
    String? localImagePath,
    void Function(AnalysisStage stage)? onStage,
  }) async {
    final sha = sha256.convert(bytes).toString();

    // Walk the stages with small delays so the loading choreography reads well.
    for (final stage in AnalysisStage.values) {
      onStage?.call(stage);
      await Future<void>.delayed(const Duration(milliseconds: 620));
    }

    // Two independent unsigned ints from the hash → stable pseudo-features.
    final a = int.parse(sha.substring(0, 8), radix: 16);
    final b = int.parse(sha.substring(8, 16), radix: 16);
    final c = int.parse(sha.substring(16, 24), radix: 16);

    // Score in [2.0, 9.0], one decimal, deterministic.
    final score = (2.0 + (a % 701) / 100.0);
    final rounded = (score * 10).round() / 10;

    final category = _categories[b % _categories.length];
    final band = _bandIndex(rounded);
    final pool = _critiquesByBand[band];
    final critique = pool[c % pool.length];

    final breakdown = _mockBreakdown(a, b, c, rounded);

    return AnalysisResult(
      imageSha256: sha,
      score: rounded,
      critique: critique,
      category: category,
      // Free by default; the AnalysisController overlays the live premium flag,
      // so the locked teaser → paywall → unlock flow is exercised in demo too.
      isPremiumUnlocked: false,
      breakdown: breakdown,
      weakestDimension: breakdown
          .reduce((m, e) => e.value < m.value ? e : m)
          .label,
      localImagePath: localImagePath,
    );
  }

  @override
  Future<String> generateBetterOutfit(String imageSha256) async {
    await Future<void>.delayed(const Duration(milliseconds: 1800));
    // Rendered as a branded placeholder by the restyle widget.
    return 'mock://restyle/$imageSha256';
  }

  int _bandIndex(double score) {
    if (score < 3.5) return 0;
    if (score < 5.0) return 1;
    if (score < 6.5) return 2;
    if (score < 8.0) return 3;
    return 4;
  }

  List<BreakdownItem> _mockBreakdown(int a, int b, int c, double score) {
    // Center each dimension near the overall score, with stable jitter.
    final centerish = (score / 9.0 * 100).round();
    int jitter(int seed, int span) => (seed % (span * 2 + 1)) - span;
    int clamp(int v) => v.clamp(15, 99);

    return [
      BreakdownItem(
        label: 'Color Harmony',
        value: clamp(centerish + jitter(a, 14)),
        weight: 0.30,
        note: 'How well your colors are actually talking to each other.',
      ),
      BreakdownItem(
        label: 'Palette Discipline',
        value: clamp(centerish + jitter(a >> 3, 16)),
        weight: 0.18,
        note: 'Fewer, more intentional colors read richer.',
      ),
      BreakdownItem(
        label: 'Formality Match',
        value: clamp(centerish + jitter(b, 18)),
        weight: 0.24,
        note: 'Whether every piece RSVP’d to the same event.',
      ),
      BreakdownItem(
        label: 'Fit & Proportion',
        value: clamp(centerish + jitter(b >> 4, 14)),
        weight: 0.16,
        note: 'Silhouette and how it works with your frame.',
      ),
      BreakdownItem(
        label: 'Framing',
        value: clamp(centerish + jitter(c, 12)),
        weight: 0.12,
        note: 'A clean full-length shot tells the whole story.',
      ),
    ];
  }
}
