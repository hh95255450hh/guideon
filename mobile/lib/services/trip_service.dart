import 'package:dio/dio.dart';

import '../models/trip_plan.dart';
import 'api.dart';

/// Calls the Claude-powered trip planner (`POST /api/ai/trip-plan`).
class TripService {
  static Future<TripPlan> plan({
    required String request,
    int? days,
    String? interests,
    String? budget,
  }) async {
    final res = await Api.instance.dio.post(
      '/ai/trip-plan',
      data: {
        'request': request,
        if (days != null && days > 0) 'days': days,
        if (interests != null && interests.isNotEmpty) 'interests': interests,
        if (budget != null && budget.trim().isNotEmpty) 'budget': budget.trim(),
        'lang': 'ar',
      },
      // The AI itinerary can take a while to generate — give it room.
      options: Options(receiveTimeout: const Duration(seconds: 90)),
    );
    final data = res.data;
    if (data is Map && data['success'] == true && data['plan'] is Map) {
      return TripPlan.fromJson((data['plan'] as Map).cast<String, dynamic>());
    }
    final msg = (data is Map && data['message'] is String)
        ? data['message'] as String
        : 'تعذّر إنشاء الخطة. حاول مجدّداً.';
    throw Exception(msg);
  }
}
