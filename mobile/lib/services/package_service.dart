import '../models/tour_package.dart';
import 'api.dart';
import 'crash_reporter.dart';

class PackageService {
  // Parse each record independently so one malformed package (unexpected
  // field type from the API) can't silently blank the whole list — it was
  // previously possible for a single bad TourPackage.fromJson() call to
  // throw inside the .map(), which propagated out of Future.wait in
  // GuideDetailScreen._load() and left the visible package list empty even
  // though the section title (gated on isNotEmpty) had already rendered.
  static List<TourPackage> _parseList(dynamic raw, int limit, String source) {
    final list = (raw is List) ? raw : const [];
    final out = <TourPackage>[];
    var dropped = 0;
    for (final item in list) {
      // Accept ANY map: Dio/jsonDecode can hand back Map<dynamic,dynamic> for
      // nested list items, and the old strict `is Map<String,dynamic>` check
      // then silently skipped EVERY package — the tours section rendered empty
      // even though the API returned them (and no error was ever reported).
      // .cast<String,dynamic>() coerces it, matching the working profile code.
      if (item is! Map) continue;
      try {
        out.add(TourPackage.fromJson(item.cast<String, dynamic>()));
      } catch (e, s) {
        dropped++;
        CrashReporter.report(
            'PackageService.$source: failed to parse package '
            '${item['id']}: $e',
            s);
      }
      if (out.length >= limit) break;
    }
    if (dropped > 0) {
      CrashReporter.report(
          'PackageService.$source: dropped $dropped/${list.length} packages',
          null);
    }
    return out;
  }

  /// All published tours offered by one provider (guide/company).
  /// GET /api/packages?providerId=… pushes the filter to the backend.
  static Future<List<TourPackage>> byProvider(String providerId, {int limit = 20}) async {
    final res = await Api.instance.get('/packages',
        query: {'providerId': providerId, 'limit': limit});
    final data = res.data is Map ? res.data['packages'] : null;
    final result = _parseList(data, limit, 'byProvider');
    // TEMP DIAGNOSTIC (remove after root-cause): report the exact shapes so the
    // "tours fetched but not shown" bug can be pinned from the server logs.
    CrashReporter.report(
        'DIAG byProvider($providerId): '
        'dataType=${res.data.runtimeType} '
        'packagesType=${data.runtimeType} '
        'rawLen=${data is List ? data.length : "n/a"} '
        'parsed=${result.length} '
        'firstItemType=${data is List && data.isNotEmpty ? data.first.runtimeType : "n/a"}',
        null);
    return result;
  }

  /// Fetches the most popular/featured published tour packages.
  static Future<List<TourPackage>> popular({int limit = 8}) async {
    final res = await Api.instance.get('/packages/popular');
    final data = res.data is Map ? res.data['packages'] : null;
    return _parseList(data, limit, 'popular');
  }

  static Future<List<TourPackage>> list({
    String? destination,
    String? category,
    int limit = 20,
  }) async {
    final params = <String, dynamic>{'limit': limit};
    if (destination != null && destination.trim().isNotEmpty) {
      params['destination'] = destination.trim();
    }
    if (category != null && category.trim().isNotEmpty) {
      params['category'] = category.trim();
    }
    final res = await Api.instance.get('/packages', query: params);
    final data = res.data is Map ? res.data['packages'] : null;
    return _parseList(data, limit, 'list');
  }
}
