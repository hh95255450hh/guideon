/// A tour guide as returned by GET /api/guides.
class Guide {
  final String id;
  final String fullName;
  final String userType; // guide | company
  final String bio;
  final String? photo;
  final double rating;
  final int totalReviews;
  final num pricePerDay;
  final List<String> languages;
  final List<String> specialisations;
  final List<String> destinations;
  final bool isVerified;

  Guide({
    required this.id,
    required this.fullName,
    required this.userType,
    required this.bio,
    required this.photo,
    required this.rating,
    required this.totalReviews,
    required this.pricePerDay,
    required this.languages,
    required this.specialisations,
    required this.destinations,
    required this.isVerified,
  });

  static List<String> _strList(dynamic v) {
    if (v is List) return v.map((e) => e.toString()).toList();
    return const [];
  }

  factory Guide.fromJson(Map<String, dynamic> j) => Guide(
        id: (j['id'] ?? '').toString(),
        fullName: (j['fullName'] ?? '').toString(),
        userType: (j['userType'] ?? 'guide').toString(),
        bio: (j['bio'] ?? '').toString(),
        photo: j['photo']?.toString(),
        rating: (j['rating'] is num) ? (j['rating'] as num).toDouble() : 0,
        totalReviews:
            (j['totalReviews'] is num) ? (j['totalReviews'] as num).toInt() : 0,
        pricePerDay: (j['pricePerDay'] is num) ? j['pricePerDay'] as num : 0,
        languages: _strList(j['languages']),
        specialisations: _strList(j['specialisations']),
        destinations: _strList(j['destinations']),
        isVerified: j['isVerified'] == true,
      );
}
