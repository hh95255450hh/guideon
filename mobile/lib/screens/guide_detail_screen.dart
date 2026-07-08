import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../models/guide.dart';
import '../models/tour_package.dart';
import '../services/api.dart';
import '../services/auth_service.dart';
import '../services/crash_reporter.dart';
import '../services/guide_service.dart';
import '../services/package_service.dart';
import '../theme/app_theme.dart';
import 'login_screen.dart';

class GuideDetailScreen extends StatefulWidget {
  final Guide guide;
  const GuideDetailScreen({super.key, required this.guide});

  @override
  State<GuideDetailScreen> createState() => _GuideDetailScreenState();
}

class _GuideDetailScreenState extends State<GuideDetailScreen> {
  late Guide _guide;                       // starts as the summary, upgraded to full
  List<TourPackage> _packages = [];
  List<Map<String, dynamic>> _reviews = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _guide = widget.guide;
    _load();
  }

  Future<void> _load() async {
    // Fetch the FULL profile (+reviews) and the guide's tours in parallel. The
    // object passed from the list is only a summary — without this the detail
    // screen showed a truncated bio and no tours at all.
    try {
      final results = await Future.wait([
        GuideService.profile(_guide.id),
        PackageService.byProvider(_guide.id),
      ]);
      final prof = results[0] as ({Guide? guide, List<Map<String, dynamic>> reviews});
      final pkgs = results[1] as List<TourPackage>;
      if (!mounted) return;
      setState(() {
        if (prof.guide != null) _guide = prof.guide!;
        _reviews = prof.reviews;
        _packages = pkgs;
        _loading = false;
      });
    } catch (e, s) {
      // Report so a fetch/parse failure here is visible in future — this used
      // to fail silently, which made a "tours section title shows but no
      // cards" report impossible to diagnose from server-side telemetry.
      CrashReporter.report('GuideDetailScreen._load(${_guide.id}): $e', s);
      if (mounted) setState(() => _loading = false); // keep the summary we have
    }
  }

  @override
  Widget build(BuildContext context) {
    final g = _guide;
    return Scaffold(
      appBar: AppBar(title: Text(g.fullName)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(60),
              child: (g.photo != null && g.photo!.isNotEmpty)
                  ? CachedNetworkImage(
                      imageUrl: g.photo!,
                      width: 120,
                      height: 120,
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => _ph(),
                    )
                  : _ph(),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: Text(g.fullName,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.w800)),
              ),
              if (g.isVerified) ...[
                const SizedBox(width: 6),
                const Icon(Icons.verified, color: GdColors.teal, size: 20),
              ],
            ],
          ),
          const SizedBox(height: 6),
          Center(
            child: Text(
              g.rating > 0
                  ? '⭐ ${g.rating.toStringAsFixed(1)} · ${g.totalReviews} تقييم'
                  : 'مرشد جديد',
              style: const TextStyle(color: GdColors.muted),
            ),
          ),
          const SizedBox(height: 20),
          if (g.bio.isNotEmpty) ...[
            const _SectionTitle('نبذة'),
            Text(g.bio, style: const TextStyle(height: 1.6)),
            const SizedBox(height: 16),
          ],
          if (g.languages.isNotEmpty) _chips('اللغات', g.languages),
          if (g.specialisations.isNotEmpty) _chips('التخصّصات', g.specialisations),
          if (g.destinations.isNotEmpty) _chips('الوجهات', g.destinations),

          // ── Tours / packages ──────────────────────────────────────────────
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator(color: GdColors.teal)),
            )
          else if (_packages.isNotEmpty) ...[
            const SizedBox(height: 8),
            const _SectionTitle('الرحلات المتاحة'),
            ..._packages.map(_packageCard),
            const SizedBox(height: 8),
          ],

          // ── Reviews ────────────────────────────────────────────────────────
          if (!_loading && _reviews.isNotEmpty) ...[
            const SizedBox(height: 8),
            _SectionTitle('التقييمات (${_reviews.length})'),
            ..._reviews.take(10).map(_reviewCard),
            const SizedBox(height: 8),
          ],

          const SizedBox(height: 16),
          if (g.pricePerDay > 0)
            Center(
              child: Text('${g.pricePerDay} ر.ع / يوم',
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: GdColors.teal)),
            ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: () => _book(g),
            icon: const Icon(Icons.event_available),
            label: const Text('احجز الآن'),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  // ── Package (tour) card → opens the full tour page in the in-app WebView ──
  Widget _packageCard(TourPackage p) {
    return InkWell(
      onTap: () => _openWeb(
          'https://guideon.om/tour-package.html?id=${p.id}', p.title),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFD6EFE9)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.horizontal(right: Radius.circular(14)),
              child: (p.coverImage != null && p.coverImage!.isNotEmpty)
                  ? CachedNetworkImage(
                      imageUrl: p.coverImage!, width: 96, height: 96, fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => _pkgPh())
                  : _pkgPh(),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(p.title,
                        maxLines: 2, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    const SizedBox(height: 4),
                    Text('📍 ${p.destination} · ${p.durationLabel}',
                        style: const TextStyle(color: GdColors.muted, fontSize: 12)),
                    const SizedBox(height: 4),
                    Text(
                        p.priceAdult > 0 ? '${p.priceAdult.toStringAsFixed(0)} ر.ع' : 'بالاتفاق',
                        style: const TextStyle(
                            color: GdColors.teal, fontWeight: FontWeight.w800, fontSize: 14)),
                  ],
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(left: 8),
              child: Icon(Icons.chevron_left, color: GdColors.muted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _reviewCard(Map<String, dynamic> r) {
    final name = (r['touristName'] ?? 'سائح').toString();
    final rating = (r['rating'] is num) ? (r['rating'] as num).toInt() : 0;
    final comment = (r['comment'] ?? '').toString();
    final reply = (r['guideReply'] ?? '').toString();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FBFA),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(name,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              ),
              Text('⭐' * rating.clamp(0, 5).toInt(),
                  style: const TextStyle(fontSize: 12)),
            ],
          ),
          if (comment.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(comment, style: const TextStyle(height: 1.5, fontSize: 13)),
          ],
          if (reply.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF7F5),
                borderRadius: BorderRadius.circular(8),
                border: const Border(right: BorderSide(color: GdColors.teal, width: 3)),
              ),
              child: Text('↩️ ردّ المرشد: $reply',
                  style: const TextStyle(fontSize: 12.5, color: GdColors.navy)),
            ),
          ],
        ],
      ),
    );
  }

  // Booking requires an authenticated session (the WebView reuses the native
  // cookie via cookie-sync). If the user is logged out, send them to the native
  // login first so checkout doesn't open as a broken/guest session.
  Future<void> _book(Guide g) async {
    final auth = context.read<AuthService>();
    if (!auth.isLoggedIn) {
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      // Re-check after the login screen closes; only proceed if now logged in.
      if (!mounted || !context.read<AuthService>().isLoggedIn) return;
    }
    _openWeb('https://guideon.om/guide-profile.html?id=${g.id}',
        'احجز مع ${g.fullName}');
  }

  // Open a guideon.om page (booking / tour) inside the in-app WebView.
  void _openWeb(String url, String title) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => _WebSheet(url: url, title: title),
    ));
  }

  Widget _ph() => Container(
        width: 120,
        height: 120,
        color: const Color(0xFFE2F0EE),
        child: const Icon(Icons.person, size: 56, color: GdColors.teal),
      );

  Widget _pkgPh() => Container(
        width: 96,
        height: 96,
        color: const Color(0xFFE2F0EE),
        child: const Icon(Icons.landscape, size: 34, color: GdColors.teal),
      );

  Widget _chips(String title, List<String> items) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionTitle(title),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: items
                .map((e) => Chip(
                      label: Text(e, style: const TextStyle(fontSize: 12.5)),
                      backgroundColor: const Color(0xFFF0FAF8),
                      side: const BorderSide(color: Color(0xFFD6EFE9)),
                    ))
                .toList(),
          ),
          const SizedBox(height: 16),
        ],
      );
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text,
            style:
                const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
      );
}

/// In-app WebView sheet — used for booking/payment pages so the user
/// never leaves the app context and session cookies are shared.
class _WebSheet extends StatefulWidget {
  final String url;
  final String title;
  const _WebSheet({required this.url, required this.title});
  @override
  State<_WebSheet> createState() => _WebSheetState();
}

class _WebSheetState extends State<_WebSheet> {
  late final WebViewController _ctrl;
  double _progress = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _ctrl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) => setState(() => _progress = p / 100),
        onPageStarted: (_) => setState(() { _loading = true; }),
        onPageFinished: (_) => setState(() { _loading = false; }),
      ));
    _syncCookiesThenLoad();
  }

  // The WebView keeps its own cookie store, separate from the app's Dio jar,
  // so a natively-logged-in user would appear logged OUT inside the booking/
  // payment page. Copy the express-session cookie over before loading so the
  // checkout opens authenticated.
  Future<void> _syncCookiesThenLoad() async {
    try {
      final cm = WebViewCookieManager();
      for (final c in await Api.instance.sessionCookies()) {
        await cm.setCookie(WebViewCookie(
          name: c.name,
          value: c.value,
          domain: 'guideon.om',
          path: (c.path == null || c.path!.isEmpty) ? '/' : c.path!,
        ));
      }
    } catch (_) {/* not logged in / no cookies — load anyway */}
    if (mounted) _ctrl.loadRequest(Uri.parse(widget.url));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title, style: const TextStyle(fontSize: 15)),
        backgroundColor: GdColors.teal,
        foregroundColor: Colors.white,
        bottom: _loading
            ? PreferredSize(
                preferredSize: const Size.fromHeight(3),
                child: LinearProgressIndicator(
                  value: _progress == 0 ? null : _progress,
                  color: GdColors.gold,
                  backgroundColor: Colors.white30,
                ),
              )
            : null,
      ),
      body: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) async {
          if (didPop) return;
          if (await _ctrl.canGoBack()) {
            _ctrl.goBack();
          } else {
            if (context.mounted) Navigator.of(context).pop();
          }
        },
        child: WebViewWidget(controller: _ctrl),
      ),
    );
  }
}
