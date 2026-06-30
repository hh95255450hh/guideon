import '../models/tour_package.dart';
import 'api.dart';

class PackageService {
  /// Fetches the most popular/featured published tour packages.
  static Future<List<TourPackage>> popular({int limit = 8}) async {
    final res = await Api.instance.get('/packages/popular');
    final list = (res.data is Map && res.data['packages'] is List)
        ? res.data['packages'] as List
        : const [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(TourPackage.fromJson)
        .take(limit)
        .toList();
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
    final list = (res.data is Map && res.data['packages'] is List)
        ? res.data['packages'] as List
        : const [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(TourPackage.fromJson)
        .take(limit)
        .toList();
  }
}
