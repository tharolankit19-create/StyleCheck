import 'package:firebase_auth/firebase_auth.dart';
import '../../core/error/failures.dart';

/// Anonymous-only authentication. No signup, no email, no social login — the
/// app silently establishes an anonymous session and reuses it. The uid is used
/// as the RevenueCat app_user_id so entitlements line up server-side.
class AuthService {
  AuthService({FirebaseAuth? auth, bool mock = false})
      : _auth = mock ? null : (auth ?? FirebaseAuth.instance),
        _mock = mock;

  final FirebaseAuth? _auth;
  final bool _mock;
  String? _mockUid;

  Stream<String?> get uidChanges =>
      _mock ? const Stream.empty() : _auth!.authStateChanges().map((u) => u?.uid);

  String? get currentUid => _mock ? _mockUid : _auth?.currentUser?.uid;

  /// Ensures an anonymous session exists and returns the uid.
  Future<String> ensureSignedIn() async {
    if (_mock) {
      return _mockUid ??= 'mock-user-0001';
    }
    final existing = _auth!.currentUser;
    if (existing != null) return existing.uid;
    try {
      final cred = await _auth.signInAnonymously();
      return cred.user!.uid;
    } on FirebaseAuthException catch (_) {
      throw const AuthFailure();
    }
  }
}
