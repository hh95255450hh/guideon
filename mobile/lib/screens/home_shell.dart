import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../services/app_update.dart';
import '../theme/app_theme.dart';
import '../widgets/web_tab.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  // The app mirrors the guideon.om platform: each tab is a session-synced
  // WebView of the matching page. Bookings/Account point at the dashboard,
  // which the web guard routes to the right role's page (or login).
  static const _tabUrls = [
    'https://guideon.om/',                                 // الرئيسية
    'https://guideon.om/search.html',                      // بحث
    'https://guideon.om/tourist-dashboard.html#bookings',  // حجوزاتي
    'https://guideon.om/explore.html',                     // الخارطة
    'https://guideon.om/tourist-dashboard.html',           // حسابي
  ];

  // Controllers per tab so the hardware back button drives the active tab's
  // web history instead of exiting the app on the first back press.
  final List<WebViewController?> _controllers =
      List<WebViewController?>.filled(5, null);

  @override
  void initState() {
    super.initState();
    _checkUpdate();
  }

  Future<void> _checkUpdate() async {
    final info = await AppUpdate.check();
    if (!mounted || info == null || !info.mustUpdate) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        title: const Text('تحديث مطلوب', textAlign: TextAlign.center),
        content: Text(info.message, textAlign: TextAlign.center),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.system_update),
              label: const Text('تحديث الآن'),
              onPressed: () async {
                if (info.storeUrl.isNotEmpty) {
                  await launchUrl(Uri.parse(info.storeUrl),
                      mode: LaunchMode.externalApplication);
                }
              },
            ),
          ),
        ],
      ),
    );
  }

  void _onTap(int i) {
    HapticFeedback.selectionClick();
    setState(() => _index = i);
  }

  // Hardware back: step back through the active tab's web history first;
  // only leave the app when there's nowhere left to go back to.
  Future<void> _handleBack() async {
    final c = _controllers[_index];
    if (c != null && await c.canGoBack()) {
      c.goBack();
      return;
    }
    if (_index != 0) {
      setState(() => _index = 0); // fall back to Home before exiting
      return;
    }
    await SystemNavigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBack();
      },
      child: Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          for (var i = 0; i < _tabUrls.length; i++)
            WebTab(url: _tabUrls[i], onReady: (c) => _controllers[i] = c),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: .08),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _navItem(0, Icons.home_outlined,          Icons.home,              'الرئيسية'),
                _navItem(1, Icons.search,                  Icons.search,            'بحث'),
                _navItem(2, Icons.calendar_today_outlined, Icons.calendar_today,    'حجوزاتي'),
                _navItem(3, Icons.map_outlined,            Icons.map,               'الخارطة'),
                _navItem(4, Icons.person_outline,          Icons.person,            'حسابي'),
              ],
            ),
          ),
        ),
      ),
    ),
    );
  }

  Widget _navItem(int i, IconData icon, IconData activeIcon, String label) {
    final selected = _index == i;
    return GestureDetector(
      onTap: () => _onTap(i),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? GdColors.teal.withValues(alpha: .1) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              selected ? activeIcon : icon,
              color: selected ? GdColors.teal : GdColors.muted,
              size: 22,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
                color: selected ? GdColors.teal : GdColors.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
