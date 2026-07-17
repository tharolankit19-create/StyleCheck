import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/app_config.dart';

/// Opens external legal/support links. Store review requires working Terms and
/// Privacy links on the paywall.
abstract final class ExternalLinks {
  static Future<void> _open(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null || !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open $url')),
        );
      }
    }
  }

  static Future<void> privacy(BuildContext context) =>
      _open(context, AppConfig.privacyPolicyUrl);

  static Future<void> terms(BuildContext context) =>
      _open(context, AppConfig.termsOfServiceUrl);

  static Future<void> support(BuildContext context) => _open(
        context,
        'mailto:${AppConfig.supportEmail}?subject=StyleCheck%20Support',
      );
}
