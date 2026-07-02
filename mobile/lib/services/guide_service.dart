import '../models/guide.dart';
import 'api.dart';

class GuideService {
  static Future<List<Guide>> search({
    String? query,
    String? sortBy,
    int limit = 24,
  }) async {
    final params = <String, dynamic>{'limit': limit};
    if (query != null && query.trim().isNotEmpty) params['destination'] = query.trim();
    final res = await Api.instance.get('/guides', query: params);
    final list = (res.data is Map && res.data['guides'] is List)
        ? res.data['guides'] as List
        : const [];
    return list.whereType<Map<String, dynamic>>().map(Guide.fromJson).toList();
  }

  static Future<Guide?> byId(String id) async {
    final res = await Api.instance.get('/guides/$id');
    final data = res.data;
    if (data is Map && data['guide'] is Map) {
      return Guide.fromJson((data['guide'] as Map).cast<String, dynamic>());
    }
    if (data is Map && data['id'] != null) {
      return Guide.fromJson(data.cast<String, dynamic>());
    }
    return null;
  }

  /// Full public profile PLUS the guide's reviews (GET /api/guides/:id returns
  /// { guide, reviews }). The list/search Guide object is only a summary, so the
  /// detail screen must fetch this to show the complete bio + reviews.
  static Future<({Guide? guide, List<Map<String, dynamic>> reviews})> profile(String id) async {
    final res = await Api.instance.get('/guides/$id');
    final data = res.data;
    Guide? g;
    var revs = <Map<String, dynamic>>[];
    if (data is Map) {
      final gm = data['guide'];
      if (gm is Map) {
        g = Guide.fromJson(gm.cast<String, dynamic>());
      } else if (data['id'] != null) {
        g = Guide.fromJson(data.cast<String, dynamic>());
      }
      final r = data['reviews'];
      if (r is List) {
        revs = r.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
      }
    }
    return (guide: g, reviews: revs);
  }
}
