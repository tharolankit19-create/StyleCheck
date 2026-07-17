/// User-facing failure taxonomy. Every layer maps low-level exceptions into one
/// of these so the UI can show a friendly, on-brand message instead of a stack
/// trace or a raw vendor error.
sealed class AppFailure implements Exception {
  const AppFailure(this.message);
  final String message;

  @override
  String toString() => message;
}

class NetworkFailure extends AppFailure {
  const NetworkFailure()
      : super("You're offline. Reconnect and try again.");
}

class QuotaFailure extends AppFailure {
  const QuotaFailure(super.message);
}

class AuthFailure extends AppFailure {
  const AuthFailure() : super("Couldn't start a session. Try again.");
}

class AnalysisFailure extends AppFailure {
  const AnalysisFailure([String? m])
      : super(m ?? "We couldn't read that photo. Try a clearer full-body shot.");
}

class PremiumRequiredFailure extends AppFailure {
  const PremiumRequiredFailure()
      : super('This is a premium feature.');
}

class RestyleFailure extends AppFailure {
  const RestyleFailure([String? m])
      : super(m ?? "The restyle didn't come through. Give it another shot.");
}

class PurchaseFailure extends AppFailure {
  const PurchaseFailure(super.message);
}

class UnknownFailure extends AppFailure {
  const UnknownFailure() : super('Something went sideways. Try again.');
}
