/// A tour package as returned by GET /api/packages/popular or /api/packages.
class TourPackage {
  final String id;
  final String title;
  final String destination;
  final String? coverImage;
  final double priceAdult;
  final int durationDays;
  final int durationHours;
  final int durationMinutes;
  final double rating;
  final int totalReviews;
  final String? category;
  final bool isFeatured;
  final String providerId;

  TourPackage({
    required this.id,
    required this.title,
    required this.destination,
    this.coverImage,
    required this.priceAdult,
    required this.durationDays,
    this.durationHours = 0,
    this.durationMinutes = 0,
    required this.rating,
    required this.totalReviews,
    this.category,
    required this.isFeatured,
    required this.providerId,
  });

  factory TourPackage.fromJson(Map<String, dynamic> j) => TourPackage(
        id: (j['id'] ?? '').toString(),
        title: (j['title'] ?? '').toString(),
        destination: (j['destination'] ?? '').toString(),
        coverImage: j['coverImage']?.toString() ?? j['cover_image']?.toString(),
        priceAdult: _num(j['price_adult'] ?? j['priceAdult']),
        durationDays: (j['duration_days'] ?? j['durationDays'] ?? 1) is num
            ? (j['duration_days'] ?? j['durationDays'] ?? 1).toInt()
            : 1,
        durationHours: _int(j['duration_hours'] ?? j['durationHours']),
        durationMinutes: _int(j['duration_minutes'] ?? j['durationMinutes']),
        rating: _num(j['rating']),
        totalReviews: (j['totalReviews'] ?? j['total_reviews'] ?? 0) is num
            ? (j['totalReviews'] ?? j['total_reviews'] ?? 0).toInt()
            : 0,
        category: j['category']?.toString(),
        isFeatured: j['isFeatured'] == true,
        providerId: (j['providerId'] ?? '').toString(),
      );

  static double _num(dynamic v) =>
      v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;

  static int _int(dynamic v) =>
      v is num ? v.toInt() : int.tryParse(v?.toString() ?? '') ?? 0;

  /// Human-readable duration — falls back to hours/minutes for tours under a
  /// day (e.g. a 90-minute walking tour) instead of always showing "0 يوم",
  /// which is meaningless and reads as a data-entry error to tourists.
  String get durationLabel {
    if (durationDays > 0) {
      return '$durationDays ${durationDays == 1 ? 'يوم' : 'أيام'}';
    }
    if (durationHours > 0) {
      final h = '$durationHours ${durationHours == 1 ? 'ساعة' : 'ساعات'}';
      return durationMinutes > 0 ? '$h $durationMinutes د' : h;
    }
    if (durationMinutes > 0) return '$durationMinutes دقيقة';
    return 'بحسب الاتفاق';
  }
}
