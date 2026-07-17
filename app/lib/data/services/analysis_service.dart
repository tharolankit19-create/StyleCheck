import 'dart:typed_data';
import '../models/analysis_result.dart';

/// Coarse stages of an analysis, surfaced to the loading UI so the wait feels
/// intentional rather than blank.
enum AnalysisStage {
  uploading('Uploading your fit'),
  detecting('Reading colors & garments'),
  scoring('Doing the math (no vibes, just features)'),
  finishing('Writing the verdict');

  const AnalysisStage(this.label);
  final String label;
}

/// Contract for producing an [AnalysisResult] from image bytes. Implemented by
/// both the live backend and the deterministic mock.
abstract interface class AnalysisService {
  /// Analyze [bytes]. [onStage] reports progress. [localImagePath] is attached
  /// to the result for display.
  Future<AnalysisResult> analyze(
    Uint8List bytes, {
    String? localImagePath,
    void Function(AnalysisStage stage)? onStage,
  });

  /// Generate (or fetch cached) "better outfit" image for a prior analysis.
  /// Returns the image URL. Premium only.
  Future<String> generateBetterOutfit(String imageSha256);
}
