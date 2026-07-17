import 'dart:typed_data';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:crypto/crypto.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_storage/firebase_storage.dart';

import '../../core/config/app_config.dart';
import '../../core/error/failures.dart';
import '../models/analysis_result.dart';
import 'analysis_service.dart';
import 'auth_service.dart';

/// Live implementation: uploads the photo to Cloud Storage, then calls the
/// `analyzeOutfit` Cloud Function. The SHA-256 of the bytes both names the
/// upload and lets the backend dedupe → deterministic, cache-friendly.
class LiveAnalysisService implements AnalysisService {
  LiveAnalysisService({
    required AuthService auth,
    FirebaseStorage? storage,
    FirebaseFunctions? functions,
  })  : _auth = auth,
        _storage = storage ?? FirebaseStorage.instance,
        _functions = functions ??
            FirebaseFunctions.instanceFor(region: AppConfig.functionsRegion);

  final AuthService _auth;
  final FirebaseStorage _storage;
  final FirebaseFunctions _functions;

  @override
  Future<AnalysisResult> analyze(
    Uint8List bytes, {
    String? localImagePath,
    void Function(AnalysisStage stage)? onStage,
  }) async {
    final uid = await _auth.ensureSignedIn();
    final sha = sha256.convert(bytes).toString();
    final path = 'uploads/$uid/$sha.jpg';

    try {
      onStage?.call(AnalysisStage.uploading);
      final ref = _storage.ref(path);
      await ref.putData(
        bytes,
        SettableMetadata(contentType: 'image/jpeg'),
      );

      onStage?.call(AnalysisStage.detecting);
      final callable = _functions.httpsCallable(
        'analyzeOutfit',
        options: HttpsCallableOptions(timeout: const Duration(seconds: 60)),
      );
      onStage?.call(AnalysisStage.scoring);
      final res = await callable.call<Map<String, dynamic>>({
        'storagePath': path,
        'imageSha256': sha,
      });
      onStage?.call(AnalysisStage.finishing);

      final data = Map<String, dynamic>.from(res.data);
      // Ensure the sha is present even if the function omitted it.
      data['imageSha256'] ??= sha;
      return AnalysisResult.fromMap(data, localImagePath: localImagePath);
    } on FirebaseFunctionsException catch (e) {
      throw _mapFunctionError(e);
    } on FirebaseException catch (_) {
      throw const NetworkFailure();
    }
  }

  @override
  Future<String> generateBetterOutfit(String imageSha256) async {
    await _auth.ensureSignedIn();
    try {
      final callable = _functions.httpsCallable(
        'generateBetterOutfit',
        options: HttpsCallableOptions(timeout: const Duration(seconds: 120)),
      );
      final res = await callable.call<Map<String, dynamic>>({
        'imageSha256': imageSha256,
      });
      final url = res.data['imageUrl'] as String?;
      if (url == null || url.isEmpty) throw const RestyleFailure();
      return url;
    } on FirebaseFunctionsException catch (e) {
      if (e.code == 'permission-denied') throw const PremiumRequiredFailure();
      throw RestyleFailure(e.message);
    }
  }

  AppFailure _mapFunctionError(FirebaseFunctionsException e) {
    switch (e.code) {
      case 'unauthenticated':
        return const AuthFailure();
      case 'resource-exhausted':
        return QuotaFailure(e.message ?? 'Free limit reached.');
      case 'permission-denied':
        return const PremiumRequiredFailure();
      case 'unavailable':
        return AnalysisFailure(e.message);
      case 'invalid-argument':
        return const AnalysisFailure('That image could not be processed.');
      default:
        return const UnknownFailure();
    }
  }
}
