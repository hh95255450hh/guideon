import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api.dart';
import '../services/auth_service.dart';
import '../theme/app_theme.dart';
import 'login_screen.dart';

class BookingsScreen extends StatefulWidget {
  const BookingsScreen({super.key});

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> {
  List<Map<String, dynamic>> _bookings = [];
  bool _loading = false;
  String? _error;

  Future<void> _load() async {
    final auth = context.read<AuthService>();
    if (!auth.isLoggedIn) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Tourists use /bookings/mine; providers use /bookings/provider.
      final path =
          auth.user!.isProvider ? '/bookings/provider' : '/bookings/mine';
      final res = await Api.instance.get(path);
      final list = (res.data is Map && res.data['bookings'] is List)
          ? (res.data['bookings'] as List)
          : const [];
      if (!mounted) return;
      setState(() => _bookings =
          list.whereType<Map<String, dynamic>>().toList());
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final loggedIn = context.watch<AuthService>().isLoggedIn;
    // Lazy-load when the user becomes logged-in and we have nothing yet.
    if (loggedIn && _bookings.isEmpty && !_loading && _error == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    }
    return Scaffold(
      appBar: AppBar(title: const Text('حجوزاتي')),
      body: !loggedIn ? _guest() : _content(),
    );
  }

  Widget _guest() => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.calendar_month_outlined,
                  size: 72, color: GdColors.muted),
              const SizedBox(height: 16),
              const Text('سجّل الدخول لعرض حجوزاتك',
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

  Widget _content() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: GdColors.muted)),
            const SizedBox(height: 12),
            OutlinedButton(
                onPressed: _load, child: const Text('إعادة المحاولة')),
          ],
        ),
      );
    }
    if (_bookings.isEmpty) {
      return const Center(
        child: Text('لا توجد حجوزات بعد.',
            style: TextStyle(color: GdColors.muted)),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _bookings.length,
        itemBuilder: (_, i) => _bookingTile(_bookings[i]),
      ),
    );
  }

  Widget _bookingTile(Map<String, dynamic> b) {
    final status = (b['status'] ?? 'pending').toString();
    final title = (b['guideName'] ??
            b['touristName'] ??
            b['tourTitle'] ??
            'حجز')
        .toString();
    final date = (b['tourDate'] ?? b['date'] ?? '').toString();
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: _statusColor(status).withValues(alpha: .15),
          child: Icon(Icons.event, color: _statusColor(status)),
        ),
        title: Text(title,
            style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(date.isNotEmpty ? '📅 $date' : ''),
        trailing: Chip(
          label: Text(_statusLabel(status),
              style: const TextStyle(fontSize: 11, color: Colors.white)),
          backgroundColor: _statusColor(status),
          visualDensity: VisualDensity.compact,
        ),
      ),
    );
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'confirmed':
        return GdColors.success;
      case 'completed':
        return GdColors.teal;
      case 'cancelled':
        return GdColors.danger;
      default:
        return GdColors.gold;
    }
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'confirmed':
        return 'مؤكّد';
      case 'completed':
        return 'مكتمل';
      case 'cancelled':
        return 'ملغى';
      default:
        return 'قيد الانتظار';
    }
  }
}
