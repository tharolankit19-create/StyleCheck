# StyleCheck release ProGuard/R8 rules.
# Modern Firebase & RevenueCat plugins ship consumer rules, so this is mostly a
# safety net. Keep annotated models and plugin entry points.

# Flutter
-keep class io.flutter.** { *; }
-dontwarn io.flutter.**

# Firebase
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# RevenueCat
-keep class com.revenuecat.** { *; }
-dontwarn com.revenuecat.**

# Play Integrity (App Check)
-keep class com.google.android.play.core.** { *; }
