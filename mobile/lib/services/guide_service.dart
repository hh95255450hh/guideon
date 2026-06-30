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
}
