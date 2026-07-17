import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:stylecheck/data/services/mock_analysis_service.dart';

/// The mock service must honor the same hard contract as the backend:
/// the same image always produces the same score, critique and category.
void main() {
  final service = MockAnalysisService();
  Uint8List bytesFor(String s) => Uint8List.fromList(utf8.encode(s));

  test('same image yields identical score, critique and category', () async {
    final a = await service.analyze(bytesFor('outfit-one'));
    final b = await service.analyze(bytesFor('outfit-one'));
    expect(a.score, b.score);
    expect(a.critique, b.critique);
    expect(a.category, b.category);
    expect(a.imageSha256, b.imageSha256);
  });

  test('different images generally differ', () async {
    final a = await service.analyze(bytesFor('outfit-one'));
    final b = await service.analyze(bytesFor('completely-different'));
    expect(a.imageSha256, isNot(b.imageSha256));
  });

  test('score always sits in the 2.0 - 9.0 band, one decimal', () async {
    for (final seed in ['a', 'b', 'c', 'longer-seed-value', '12345']) {
      final r = await service.analyze(bytesFor(seed));
      expect(r.score, greaterThanOrEqualTo(2.0));
      expect(r.score, lessThanOrEqualTo(9.0));
      expect((r.score * 10).round(), r.score * 10);
    }
  });

  test('breakdown has five weighted dimensions', () async {
    final r = await service.analyze(bytesFor('outfit-one'));
    expect(r.breakdown.length, 5);
    final totalWeight =
        r.breakdown.fold<double>(0, (sum, b) => sum + b.weight);
    expect(totalWeight, closeTo(1.0, 0.001));
  });
}
