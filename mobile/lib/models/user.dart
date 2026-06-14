/// The signed-in account as returned by GET /api/auth/me.
class AppUser {
  final String id;
  final String fullName;
  final String email;
  final String userType; // tourist | guide | company | team | admin
  final String? photo;

  AppUser({
    required this.id,
    required this.fullName,
    required this.email,
    required this.userType,
    required this.photo,
  });

  bool get isProvider =>
      userType == 'guide' || userType == 'company' || userType == 'team';

  factory AppUser.fromJson(Map<String, dynamic> j) {
    // Backend may nest under `user` or return fields at the top level.
    final u = (j['user'] is Map) ? j['user'] as Map : j;
    return AppUser(
      id: (u['id'] ?? '').toString(),
      fullName: (u['fullName'] ?? '').toString(),
      email: (u['email'] ?? '').toString(),
      userType: (u['userType'] ?? 'tourist').toString(),
      photo: u['photo']?.toString(),
    );
  }
}
