/// A tour package as returned by GET /api/packages/popular or /api/packages.
class TourPackage {
  final String id;
  final String title;
  final String destination;
  final String? coverImage;
  final double priceAdult;
  final int durationDays;
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
}
