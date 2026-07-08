import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme/app_theme.dart';
import '../widgets/web_sheet.dart';
import 'login_screen.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    return Scaffold(
      backgroundColor: GdColors.sand,
      appBar: AppBar(title: const Text('حسابي')),
      body: auth.isLoggedIn ? _loggedIn(context, auth) : _guest(context),
    );
  }

  Widget _guest(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: GdColors.teal.withValues(alpha: .1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.person_outline,
                    size: 52, color: GdColors.teal),
              ),
              const SizedBox(height: 20),
              const Text('مرحباً بك في Guideon',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: GdColors.navy)),
              const SizedBox(height: 8),
              const Text('سجّل الدخول لإدارة حجوزاتك ورسائلك',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: GdColors.muted)),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const LoginScreen())),
                child: const Text('تسجيل الدخول'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () =>
                    openInAppWeb(context, 'register.html', 'إنشاء حساب'),
                child: const Text('إنشاء حساب جديد'),
              ),
            ],
          ),
        ),
      );

  Widget _loggedIn(BuildContext context, AuthService auth) {
    final u = auth.user!;
    final isGuide = u.userType == 'guide';
    final isCompany = u.userType == 'company';
    final isProvider = u.isProvider;

    return ListView(
      children: [
        // ── Profile header ─────────────────────────────────────
        Container(
          color: GdColors.navy,
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
          child: Column(
            children: [
              // Avatar
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: GdColors.gold, width: 2.5),
                ),
                child: ClipOval(
                  child: (u.photo != null && u.photo!.isNotEmpty)
                      ? CachedNetworkImage(
                          imageUrl: u.photo!,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => _avatarFallback(u.fullName),
                        )
                      : _avatarFallback(u.fullName),
                ),
              ),
              const SizedBox(height: 12),
              Text(u.fullName,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(u.email,
                  style: const TextStyle(color: Colors.white60, fontSize: 13)),
              const SizedBox(height: 8),
              // Role badge
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                decoration: BoxDecoration(
                  color: _roleColor(u.userType).withValues(alpha: .2),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: _roleColor(u.userType).withValues(alpha: .5)),
                ),
                child: Text(
                  _roleLabel(u.userType),
                  style: TextStyle(
                      color: _roleColor(u.userType),
                      fontSize: 12,
                      fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),

        // ── Guide panel (only for guides/companies) ────────────
        if (isProvider) ...[
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GestureDetector(
              onTap: () => openInAppWeb(
                  context,
                  isCompany
                      ? 'company-dashboard.html'
                      : isGuide
                          ? 'guide-dashboard.html'
                          : 'team-dashboard.html',
                  'لوحة التحكّم'),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0F7B6C), Color(0xFF0A5C50)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: GdColors.teal.withValues(alpha: .3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.dashboard_outlined,
                          color: Colors.white, size: 24),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('لوحة التحكّم',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800)),
                          SizedBox(height: 3),
                          Text('إدارة الحجوزات والرسائل والأرباح',
                              style: TextStyle(
                                  color: Colors.white70, fontSize: 12)),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_left,
                        color: Colors.white70, size: 20),
                  ],
                ),
              ),
            ),
          ),
        ],

        const SizedBox(height: 16),

        // ── Menu items ─────────────────────────────────────────
        _section([
          _tile(Icons.person_outline, 'الملفّ الشخصي',
              () => openInAppWeb(context, 'profile.html', 'الملفّ الشخصي')),
          _tile(Icons.chat_bubble_outline, 'الرسائل',
              () => openInAppWeb(context,
                  '${_dashboardPage(u.userType)}#messages', 'الرسائل')),
          _tile(Icons.favorite_border, 'المفضّلة',
              () => openInAppWeb(context, 'wishlist.html', 'المفضّلة')),
        ]),

        _section([
          _tile(Icons.help_outline, 'المساعدة والدعم',
              () => openInAppWeb(context, 'contact.html', 'المساعدة والدعم')),
          _tile(Icons.privacy_tip_outlined, 'سياسة الخصوصية',
              () => openInAppWeb(context, 'privacy.html', 'سياسة الخصوصية')),
          _tile(Icons.description_outlined, 'شروط الاستخدام',
              () => openInAppWeb(context, 'terms.html', 'شروط الاستخدام')),
        ]),

        _section([
          _tile(Icons.logout, 'تسجيل الخروج', () async {
            await context.read<AuthService>().logout();
          }, color: GdColors.danger),
        ]),

        const SizedBox(height: 32),

        // App version note
        const Center(
          child: Text('Guideon — دليلك السياحي في عُمان',
              style: TextStyle(color: GdColors.muted, fontSize: 12)),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _avatarFallback(String name) {
    final initials = name.trim().isNotEmpty
        ? name.trim().split(' ').take(2).map((e) => e[0]).join()
        : '?';
    return Container(
      color: GdColors.teal,
      child: Center(
        child: Text(initials,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w800)),
      ),
    );
  }

  Widget _section(List<Widget> tiles) => Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE7EAEE)),
        ),
        child: Column(
          children: tiles
              .asMap()
              .entries
              .map((e) => Column(children: [
                    e.value,
                    if (e.key < tiles.length - 1)
                      const Divider(height: 1, indent: 56),
                  ]))
              .toList(),
        ),
      );

  Widget _tile(IconData icon, String label, VoidCallback onTap,
          {Color? color}) =>
      ListTile(
        leading: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: (color ?? GdColors.navy).withValues(alpha: .08),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color ?? GdColors.navy, size: 20),
        ),
        title: Text(label,
            style: TextStyle(
                color: color,
                fontWeight: FontWeight.w600,
                fontSize: 14)),
        trailing: const Icon(Icons.chevron_left,
            color: GdColors.muted, size: 18),
        onTap: onTap,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      );

  String _dashboardPage(String type) {
    switch (type) {
      case 'guide':
        return 'guide-dashboard.html';
      case 'company':
        return 'company-dashboard.html';
      case 'team':
        return 'team-dashboard.html';
      default:
        return 'tourist-dashboard.html';
    }
  }

  Color _roleColor(String type) {
    switch (type) {
      case 'guide':
        return GdColors.teal;
      case 'company':
        return GdColors.gold;
      case 'admin':
      case 'team':
        return const Color(0xFF7C3AED);
      default:
        return GdColors.muted;
    }
  }

  String _roleLabel(String type) {
    switch (type) {
      case 'guide':
        return '🏔️  مرشد سياحي';
      case 'company':
        return '🏢  شركة سياحية';
      case 'admin':
        return '⚙️  مدير';
      case 'team':
        return '👥  فريق';
      default:
        return '🧳  سائح';
    }
  }

}
