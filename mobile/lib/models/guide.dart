/// A tour guide as returned by GET /api/guides.
class Guide {
  final String id;
  final String fullName;
  final String userType; // guide | company
  final String bio;
  final String? photo;
  final String? profileImage;
  final double rating;
  final int totalReviews;
  final num pricePerDay;
  final List<String> languages;
  final List<String> specialisations;
  final List<String> destinations;
  final bool isVerified;
  final double? latitude;
  final double? longitude;

  Guide({
    required this.id,
    required this.fullName,
    required this.userType,
    required this.bio,
    required this.photo,
    this.profileImage,
    required this.rating,
    required this.totalReviews,
    required this.pricePerDay,
    required this.languages,
    required this.specialisations,
    required this.destinations,
    required this.isVerified,
    this.latitude,
    this.longitude,
  });

  static List<String> _strList(dynamic v) {
    if (v is List) return v.map((e) => e.toString()).toList();
    return const [];
  }

  // Oman city → approximate coordinates
  static const _cityCoords = <String, (double, double)>{
    'مسقط':    (23.5880, 58.3829),
    'muscat':  (23.5880, 58.3829),
    'مطرح':    (23.6139, 58.5922),
    'matrah':  (23.6139, 58.5922),
    'السيب':   (23.6780, 58.1892),
    'seeb':    (23.6780, 58.1892),
    'صلالة':   (17.0200, 54.0900),
    'salalah': (17.0200, 54.0900),
    'ظفار':    (17.0200, 54.0900),
    'dhofar':  (17.0200, 54.0900),
    'نزوى':    (22.9333, 57.5333),
    'nizwa':   (22.9333, 57.5333),
    'الداخلية':(22.9333, 57.5333),
    'صحار':    (24.3470, 56.7470),
    'sohar':   (24.3470, 56.7470),
    'صور':     (22.5654, 59.5289),
    'sur':     (22.5654, 59.5289),
    'البريمي': (24.2289, 55.7847),
    'buraimi': (24.2289, 55.7847),
    'عبري':    (23.2871, 56.5200),
    'ibri':    (23.2871, 56.5200),
    'إبراء':   (22.6933, 58.5325),
    'ibra':    (22.6933, 58.5325),
    'خصب':     (26.1835, 56.2521),
    'khasab':  (26.1835, 56.2521),
    'مسندم':   (26.1835, 56.2521),
    'musandam':(26.1835, 56.2521),
    'الشرقية': (22.5654, 59.5289),
    'الباطنة': (23.6780, 58.1892),
    'الوسطى':  (20.0000, 57.0000),
    'الظاهرة': (23.2871, 56.5200),
  };

  static (double, double)? _resolveCoords(
      List<String> destinations, Map<String, dynamic> j) {
    // 1. Use explicit lat/lng from API if available
    final lat = j['latitude'] ?? j['lat'];
    final lng = j['longitude'] ?? j['lng'] ?? j['lon'];
    if (lat is num && lng is num) return (lat.toDouble(), lng.toDouble());

    // 2. Map first recognised destination to a city coordinate
    for (final dest in destinations) {
      final key = dest.toLowerCase().trim();
      for (final entry in _cityCoords.entries) {
        if (key.contains(entry.key.toLowerCase()) ||
            entry.key.toLowerCase().contains(key)) {
          // Add slight jitter so overlapping markers don't stack
          final jitter = (destinations.indexOf(dest) * 0.04);
          return (entry.value.$1 + jitter, entry.value.$2 + jitter);
        }
      }
    }
    return null;
  }

  factory Guide.fromJson(Map<String, dynamic> j) {
    final dests = _strList(j['destinations']);
    final coords = _resolveCoords(dests, j);
    return Guide(
      id:             (j['id'] ?? '').toString(),
      fullName:       (j['fullName'] ?? '').toString(),
      userType:       (j['userType'] ?? 'guide').toString(),
      bio:            (j['bio'] ?? '').toString(),
      photo:          j['photo']?.toString(),
      profileImage:   j['profileImage']?.toString() ?? j['photo']?.toString(),
      rating:         (j['rating'] is num) ? (j['rating'] as num).toDouble() : 0,
      totalReviews:   (j['totalReviews'] is num) ? (j['totalReviews'] as num).toInt() : 0,
      pricePerDay:    (j['pricePerDay'] is num) ? j['pricePerDay'] as num : 0,
      languages:      _strList(j['languages']),
      specialisations:_strList(j['specialisations']),
      destinations:   dests,
      isVerified:     j['isVerified'] == true,
      latitude:       coords?.$1,
      longitude:      coords?.$2,
    );
  }
}
