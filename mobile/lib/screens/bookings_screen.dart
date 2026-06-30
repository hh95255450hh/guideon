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

class _BookingsScreenState extends State<BookingsScreen>
    with SingleTickerProviderStateMixin {
  List<Map<String, dynamic>> _bookings = [];
  bool _loading = false;
  String? _error;
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final auth = context.read<AuthService>();
    if (!auth.isLoggedIn) return;
    setState(() { _loading = true; _error = null; });
    try {
      final path = auth.user!.isProvider ? '/bookings/provider' : '/bookings/mine';
      final res = await Api.instance.get(path);
      final list = (res.data is Map && res.data['bookings'] is List)
          ? (res.data['bookings'] as List)
          : const [];
      if (!mounted) return;
      setState(() => _bookings = list.whereType<Map<String, dynamic>>().toList());
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _updateStatus(Map<String, dynamic> b, String status) async {
    final id = b['id']?.toString() ?? '';
    if (id.isEmpty) return;
    try {
      await Api.instance.put('/bookings/$id/status', data: {'status': status});
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyError(e)), backgroundColor: GdColors.danger),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final isGuide = auth.isLoggedIn && auth.user!.isProvider;

    if (auth.isLoggedIn && _bookings.isEmpty && !_loading && _error == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    }

    return Scaffold(
      backgroundColor: GdColors.sand,
      appBar: AppBar(
        title: const Text('حجوزاتي'),
        bottom: auth.isLoggedIn
            ? TabBar(
                controller: _tabs,
                labelColor: Colors.white,
                unselectedLabelColor: Colors.white60,
                indicatorColor: GdColors.gold,
                indicatorWeight: 3,
                tabs: const [
                  Tab(text: 'الكل'),
                  Tab(text: 'قادمة'),
                  Tab(text: 'مكتملة'),
                ],
              )
            : null,
      ),
      body: !auth.isLoggedIn ? _guest() : _content(isGuide),
    );
  }

  Widget _guest() => Center(
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
                child: const Icon(Icons.calendar_month_outlined,
                    size: 48, color: GdColors.teal),
              ),
              const SizedBox(height: 20),
              const Text('حجوزاتك هنا',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: GdColors.navy)),
              const SizedBox(height: 8),
              const Text('سجّل الدخول لعرض وإدارة حجوزاتك',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: GdColors.muted)),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => Navigator.of(context)
                    .push(MaterialPageRoute(builder: (_) => const LoginScreen())),
                child: const Text('تسجيل الدخول'),
              ),
            ],
          ),
        ),
      );

  Widget _content(bool isGuide) {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: GdColors.teal, strokeWidth: 2.5));
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_outlined, size: 56, color: GdColors.muted),
              const SizedBox(height: 16),
              Text(_error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: GdColors.muted)),
              const SizedBox(height: 20),
              OutlinedButton.icon(
                  onPressed: _load,
                  icon: const Icon(Icons.refresh),
                  label: const Text('إعادة المحاولة')),
            ],
          ),
        ),
      );
    }

    return TabBarView(
      controller: _tabs,
      children: [
        _list(_bookings, isGuide),
        _list(
            _bookings
                .where((b) =>
                    b['status'] == 'pending' || b['status'] == 'confirmed')
                .toList(),
            isGuide),
        _list(
            _bookings.where((b) => b['status'] == 'completed').toList(),
            isGuide),
      ],
    );
  }

  Widget _list(List<Map<String, dynamic>> items, bool isGuide) {
    if (items.isEmpty) return _emptyState();
    return RefreshIndicator(
      onRefresh: _load,
      color: GdColors.teal,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        itemCount: items.length,
        itemBuilder: (_, i) => _bookingCard(items[i], isGuide),
      ),
    );
  }

  Widget _emptyState() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                color: GdColors.teal.withValues(alpha: .08),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.event_note_outlined,
                  size: 44, color: GdColors.teal),
            ),
            const SizedBox(height: 16),
            const Text('لا توجد حجوزات',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: GdColors.navy)),
            const SizedBox(height: 6),
            const Text('حجوزاتك ستظهر هنا عند إتمامها',
                style: TextStyle(color: GdColors.muted, fontSize: 13)),
          ],
        ),
      );

  Widget _bookingCard(Map<String, dynamic> b, bool isGuide) {
    final status = (b['status'] ?? 'pending').toString();
    final otherParty = isGuide
        ? (b['touristName'] ?? 'سائح').toString()
        : (b['guideName'] ?? b['tourTitle'] ?? 'حجز').toString();
    final date = (b['tourDate'] ?? b['date'] ?? '').toString();
    final price = b['totalPrice']?.toString() ?? '';
    final isPending = status == 'pending';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isPending
              ? GdColors.warning.withValues(alpha: .4)
              : const Color(0xFFE7EAEE),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Status bar top
          Container(
            decoration: BoxDecoration(
              color: _statusColor(status).withValues(alpha: .1),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(14)),
            ),
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(
              children: [
                Icon(_statusIcon(status),
                    size: 14, color: _statusColor(status)),
                const SizedBox(width: 6),
                Text(_statusLabel(status),
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: _statusColor(status))),
                const Spacer(),
                if (date.isNotEmpty)
                  Text(date,
                      style: const TextStyle(
                          color: GdColors.muted, fontSize: 12)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: GdColors.navy.withValues(alpha: .07),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isGuide ? Icons.person_outlined : Icons.tour_outlined,
                    color: GdColors.navy,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(otherParty,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                              color: GdColors.navy)),
                      if (price.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text('$price ر.ع',
                            style: const TextStyle(
                                color: GdColors.teal,
                                fontSize: 13,
                                fontWeight: FontWeight.w600)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Guide action buttons — show only for pending bookings
          if (isGuide && isPending)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _confirmAction(b, 'cancelled'),
                      icon: const Icon(Icons.close, size: 16),
                      label: const Text('رفض'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: GdColors.danger,
                        side: const BorderSide(color: GdColors.danger),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _updateStatus(b, 'confirmed'),
                      icon: const Icon(Icons.check, size: 16),
                      label: const Text('قبول'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: GdColors.success,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(0, 42),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _confirmAction(Map<String, dynamic> b, String status) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('تأكيد الرفض'),
        content: const Text('هل تريد رفض هذا الحجز؟'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('إلغاء')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('رفض',
                  style: TextStyle(color: GdColors.danger))),
        ],
      ),
    );
    if (confirm == true) _updateStatus(b, status);
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
        return GdColors.warning;
    }
  }

  IconData _statusIcon(String s) {
    switch (s) {
      case 'confirmed':
        return Icons.check_circle_outline;
      case 'completed':
        return Icons.star_outline;
      case 'cancelled':
        return Icons.cancel_outlined;
      default:
        return Icons.hourglass_empty;
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
