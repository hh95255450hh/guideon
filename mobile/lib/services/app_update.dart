import 'package:dio/dio.dart';
import 'package:package_info_plus/package_info_plus.dart';

class AppUpdateInfo {
  final bool mustUpdate;
  final String storeUrl;
  final String message;
  const AppUpdateInfo(this.mustUpdate, this.storeUrl, this.message);
}

/// Force-update gate: compares this build to the backend's required minimum.
/// Inactive until APP_MIN_BUILD is set server-side (defaults to 0 → never
/// blocks), so it's safe to ship.
class AppUpdate {
  static Future<AppUpdateInfo?> check() async {
    try {
      final info = await PackageInfo.fromPlatform();
      final current = int.tryParse(info.buildNumber) ?? 0;
      final res = await Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 8),
      )).get('https://guideon.om/api/app/version');
      final d = res.data;
      if (d is Map) {
        final minBuild = (d['minBuild'] is num) ? (d['minBuild'] as num).toInt() : 0;
        return AppUpdateInfo(
          current < minBuild,
          d['storeUrl']?.toString() ?? '',
          d['message']?.toString() ?? 'يتوفّر تحديث جديد للتطبيق.',
        );
      }
    } catch (_) {/* offline / not configured — don't block */}
    return null;
  }
}
