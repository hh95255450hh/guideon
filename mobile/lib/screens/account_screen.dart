import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/auth_service.dart';
import '../theme/app_theme.dart';
import 'login_screen.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    return Scaffold(
      appBar: AppBar(title: const Text('حسابي')),
      body: auth.isLoggedIn ? _loggedIn(context, auth) : _guest(context),
    );
  }

  Widget _guest(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.account_circle_outlined,
                  size: 72, color: GdColors.muted),
              const SizedBox(height: 16),
              const Text('سجّل الدخول لإدارة حجوزاتك ورسائلك',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: GdColors.muted)),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const LoginScreen())),
                child: const Text('تسجيل الدخول'),
              ),
            ],
          ),
        ),
      );

  Widget _loggedIn(BuildContext context, AuthService auth) {
    final u = auth.user!;
    return ListView(
      children: [
        const SizedBox(height: 16),
        const Center(
          child: CircleAvatar(
            radius: 40,
            backgroundColor: Color(0xFFE2F0EE),
            child: Icon(Icons.person, size: 44, color: GdColors.teal),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: Text(u.fullName,
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        ),
        Center(
            child: Text(u.email,
                style: const TextStyle(color: GdColors.muted))),
        const SizedBox(height: 24),
        _tile(Icons.person_outline, 'الملفّ الشخصي',
            () => _web('profile.html')),
        _tile(Icons.chat_bubble_outline, 'الرسائل',
            () => _web('${_dashboard(u.userType)}#messages')),
        if (u.isProvider)
          _tile(Icons.dashboard_outlined, 'لوحة التحكّم',
              () => _web(_dashboard(u.userType))),
        _tile(Icons.favorite_border, 'المفضّلة',
            () => _web('wishlist.html')),
        _tile(Icons.help_outline, 'المساعدة والدعم',
            () => _web('contact.html')),
        const Divider(height: 32),
        _tile(Icons.logout, 'تسجيل الخروج', () async {
          await context.read<AuthService>().logout();
        }, color: GdColors.danger),
      ],
    );
  }

  String _dashboard(String type) {
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

  Widget _tile(IconData icon, String label, VoidCallback onTap,
          {Color? color}) =>
      ListTile(
        leading: Icon(icon, color: color ?? GdColors.navy),
        title: Text(label, style: TextStyle(color: color)),
        trailing: const Icon(Icons.chevron_left, color: GdColors.muted),
        onTap: onTap,
      );

  Future<void> _web(String page) async {
    await launchUrl(Uri.parse('https://guideon.om/$page'),
        mode: LaunchMode.externalApplication);
  }
}
