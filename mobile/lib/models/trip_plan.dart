/// AI trip-planner result models — mirror the `/api/ai/trip-plan` response.
class TripDay {
  final int day;
  final String theme;
  final String governorate;
  final List<String> activities;
  final String suggestedGuideId;
  final String suggestedGuideName;
  final String suggestedGuidePhoto;
  final double estimatedCostOMR;

  TripDay({
    required this.day,
    required this.theme,
    required this.governorate,
    required this.activities,
    required this.suggestedGuideId,
    required this.suggestedGuideName,
    required this.suggestedGuidePhoto,
    required this.estimatedCostOMR,
  });

  factory TripDay.fromJson(Map<String, dynamic> j) => TripDay(
        day: (j['day'] as num?)?.toInt() ?? 0,
        theme: j['theme']?.toString() ?? '',
        governorate: j['governorate']?.toString() ?? '',
        activities: (j['activities'] as List?)
                ?.map((e) => e.toString())
                .where((e) => e.isNotEmpty)
                .toList() ??
            const [],
        suggestedGuideId: j['suggestedGuideId']?.toString() ?? '',
        suggestedGuideName: j['suggestedGuideName']?.toString() ?? '',
        suggestedGuidePhoto: j['suggestedGuidePhoto']?.toString() ?? '',
        estimatedCostOMR: (j['estimatedCostOMR'] as num?)?.toDouble() ?? 0,
      );
}

class TripPlan {
  final String title;
  final String summary;
  final List<TripDay> days;
  final double totalEstimatedOMR;
  final List<String> tips;

  TripPlan({
    required this.title,
    required this.summary,
    required this.days,
    required this.totalEstimatedOMR,
    required this.tips,
  });

  factory TripPlan.fromJson(Map<String, dynamic> j) => TripPlan(
        title: j['title']?.toString() ?? '',
        summary: j['summary']?.toString() ?? '',
        days: (j['days'] as List?)
                ?.whereType<Map>()
                .map((e) => TripDay.fromJson(e.cast<String, dynamic>()))
                .toList() ??
            const [],
        totalEstimatedOMR: (j['totalEstimatedOMR'] as num?)?.toDouble() ?? 0,
        tips: (j['tips'] as List?)
                ?.map((e) => e.toString())
                .where((e) => e.isNotEmpty)
                .toList() ??
            const [],
      );
}
