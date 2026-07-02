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

  // Oman place → approximate coordinates (AR + EN variants). Kept in sync with
  // the web explore.html GOV_COORDS list.
  static const _cityCoords = <String, (double, double)>{
    'مسقط':    (23.5880, 58.3829),
    'muscat':  (23.5880, 58.3829),
    'مطرح':    (23.6139, 58.5922),
    'matrah':  (23.6139, 58.5922),
    'muttrah': (23.6139, 58.5922),
    'السيب':   (23.6780, 58.1892),
    'seeb':    (23.6780, 58.1892),
    'صلالة':   (17.0200, 54.0900),
    'salalah': (17.0200, 54.0900),
    'ظفار':    (17.0200, 54.0900),
    'dhofar':  (17.0200, 54.0900),
    'نزوى':    (22.9333, 57.5333),
    'nizwa':   (22.9333, 57.5333),
    'العقر':   (22.9333, 57.5333),
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
    'بهلاء':   (22.9680, 57.3060),
    'بهلا':    (22.9680, 57.3060),
    'bahla':   (22.9680, 57.3060),
    'الرستاق': (23.3900, 57.4240),
    'rustaq':  (23.3900, 57.4240),
    'الحمراء': (23.1150, 57.2980),
    'الحمرا':  (23.1150, 57.2980),
    'hamra':   (23.1150, 57.2980),
    'الجبل الاخضر':(23.0730, 57.6640),
    'jabal akhdar':(23.0730, 57.6640),
    'akhdar':  (23.0730, 57.6640),
    'جبل شمس': (23.2370, 57.2630),
    'jabal shams':(23.2370, 57.2630),
    'shams':   (23.2370, 57.2630),
    'نخل':     (23.3940, 57.8270),
    'nakhal':  (23.3940, 57.8270),
    'بدية':    (22.4460, 58.8000),
    'بديه':    (22.4460, 58.8000),
    'bidiyah': (22.4460, 58.8000),
    'bidiyya': (22.4460, 58.8000),
    'وادي بني خالد':(22.6010, 59.0380),
    'wadi bani khalid':(22.6010, 59.0380),
    'وادي شاب':(22.2130, 59.2380),
    'wadi shab':(22.2130, 59.2380),
    'wadishab':(22.2130, 59.2380),
    'وهيبه':   (22.1300, 58.8200),
    'wahiba':  (22.1300, 58.8200),
    'sharqiya sands':(22.1300, 58.8200),
    'الصحراء': (22.1300, 58.8200),
    'desert':  (22.1300, 58.8200),
    'الجبال':  (23.0730, 57.6640),
    'mountains':(23.0730, 57.6640),
    'الوديان': (22.6010, 59.0380),
    'wadis':   (22.6010, 59.0380),
    'wadi':    (22.6010, 59.0380),
    'الشرقية': (22.4460, 58.8000),
    'sharqiya':(22.4460, 58.8000),
    'sharqiyah':(22.4460, 58.8000),
    'الباطنة': (23.6780, 58.1892),
    'الوسطى':  (20.0000, 57.0000),
    'الظاهرة': (23.2871, 56.5200),
    'عمان':    (21.5000, 56.5000),
    'عُمان':   (21.5000, 56.5000),
    'oman':    (21.5000, 56.5000),
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
