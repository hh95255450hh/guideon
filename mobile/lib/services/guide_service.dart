import '../models/guide.dart';
import 'api.dart';

class GuideService {
  /// [type] mirrors the web "View all companies" toggle: pass 'company' to
  /// list tourism companies instead of individual guides (same endpoint,
  /// GET /api/guides?type=company — the backend branches on this param).
  static Future<List<Guide>> search({
    String? query,
    String? sortBy,
    String? type,
    int limit = 24,
  }) async {
    final params = <String, dynamic>{'limit': limit};
    if (query != null && query.trim().isNotEmpty) params['destination'] = query.trim();
    if (type != null && type.isNotEmpty) params['type'] = type;
    final res = await Api.instance.get('/guides', query: params);
    final list = (res.data is Map && res.data['guides'] is List)
        ? res.data['guides'] as List
        : const [];
    return list.whereType<Map<String, dynamic>>().map(Guide.fromJson).toList();
  }

  /// Convenience wrapper — top/all tourism companies.
  static Future<List<Guide>> companies({int limit = 24}) =>
      search(type: 'company', limit: limit);

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
  /// Full profile + reviews. Companies MUST hit /companies/:id — the /guides/:id
  /// endpoint 404s for a company, which made the entire company detail screen
  /// come back empty (no name, photo, tours or reviews).
  static Future<({Guide? guide, List<Map<String, dynamic>> reviews})> profile(
      String id, {bool isCompany = false}) async {
    final res = await Api.instance.get(isCompany ? '/companies/$id' : '/guides/$id');
    final data = res.data;
    Guide? g;
    var revs = <Map<String, dynamic>>[];
    if (data is Map) {
      // Guide endpoint wraps as {guide:…}; company endpoint as {company:…} or flat.
      final gm = data['guide'] ?? data['company'];
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
