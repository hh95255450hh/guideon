import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../models/guide.dart';
import '../models/tour_package.dart';
import '../services/auth_service.dart';
import '../services/guide_service.dart';
import '../services/package_service.dart';
import '../theme/app_theme.dart';
import '../widgets/guide_card.dart';
import 'guide_detail_screen.dart';
import 'search_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Guide> _top = [];
  List<Guide> _all = [];
  List<TourPackage> _packages = [];
  bool _loading = true;

  final List<Map<String, dynamic>> _destinations = [
    {'label': 'مسقط', 'en': 'Muscat', 'emoji': '🏙️'},
    {'label': 'صلالة', 'en': 'Salalah', 'emoji': '🌿'},
    {'label': 'نزوى',  'en': 'Nizwa',   'emoji': '🏰'},
    {'label': 'صحار',  'en': 'Sohar',   'emoji': '⚓'},
    {'label': 'صور',   'en': 'Sur',     'emoji': '🐢'},
    {'label': 'مسندم', 'en': 'Khasab',  'emoji': '⛵'},
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        GuideService.search(limit: 6),
        GuideService.search(limit: 20),
        PackageService.popular(limit: 8),
      ]);
      if (!mounted) return;
      setState(() {
        _top      = results[0] as List<Guide>;
        _all      = results[1] as List<Guide>;
        _packages = results[2] as List<TourPackage>;
        _loading  = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final greeting = _greeting();
    final name = auth.user?.fullName.split(' ').first ?? '';

    return Scaffold(
      backgroundColor: GdColors.sand,
      body: RefreshIndicator(
        onRefresh: _load,
        color: GdColors.teal,
        child: CustomScrollView(
          slivers: [
            // ── HEADER ──────────────────────────────────────────
            SliverAppBar(
              expandedHeight: 200,
              pinned: true,
              backgroundColor: GdColors.navy,
              flexibleSpace: FlexibleSpaceBar(
                background: Stack(
                  fit: StackFit.expand,
                  children: [
                    // Background gradient
                    Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF0f3d3a), Color(0xFF0f1c3e)],
                        ),
                      ),
                    ),
                    // Pattern overlay
                    Opacity(
                      opacity: 0.06,
                      child: Image.network(
                        'https://guideon.om/img/oman-pattern.png',
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const SizedBox(),
                      ),
                    ),
                    // Content
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 60, 20, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name.isNotEmpty ? '$greeting، $name 👋' : greeting,
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  const Text(
                                    'اكتشف عُمان مع مرشد محلي',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 19,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              ),
                              // Notification bell
                              IconButton(
                                icon: const Icon(Icons.notifications_outlined,
                                    color: Colors.white70),
                                onPressed: () {},
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          // Search field
                          GestureDetector(
                            onTap: _openSearch,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: .15),
                                    blurRadius: 12,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.search, color: GdColors.muted),
                                  const SizedBox(width: 10),
                                  const Expanded(
                                    child: Text(
                                      'ابحث عن وجهة أو مرشد…',
                                      style: TextStyle(
                                          color: GdColors.muted, fontSize: 14),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: GdColors.teal,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Text(
                                      'بحث',
                                      style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // ── DESTINATIONS ────────────────────────────────────
            SliverToBoxAdapter(
              child: _section(
                title: '🗺️ الوجهات الشهيرة',
                child: SizedBox(
                  height: 90,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _destinations.length,
                    itemBuilder: (_, i) {
                      final d = _destinations[i];
                      return GestureDetector(
                        onTap: () => _searchDest(d['en']!),
                        child: Container(
                          width: 80,
                          margin: const EdgeInsets.only(left: 10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: .06),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(d['emoji']!,
                                  style: const TextStyle(fontSize: 28)),
                              const SizedBox(height: 4),
                              Text(
                                d['label']!,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: GdColors.navy,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),

            // ── TOP GUIDES ───────────────────────────────────────
            SliverToBoxAdapter(
              child: _section(
                title: '⭐ أفضل المرشدين',
                action: TextButton(
                  onPressed: _openSearch,
                  child: const Text('عرض الكل',
                      style: TextStyle(color: GdColors.teal, fontSize: 13)),
                ),
                child: _loading
                    ? _shimmerRow()
                    : SizedBox(
                        height: 230,
                        child: _top.isEmpty
                            ? const Center(child: Text('لا يوجد مرشدون حالياً'))
                            : _AutoScrollList(
                                itemCount: _top.length,
                                itemWidth: 162,
                                itemBuilder: (i) => _guideChip(_top[i]),
                              ),
                      ),
              ),
            ),

            // ── TOP PACKAGES ────────────────────────────────────
            SliverToBoxAdapter(
              child: _section(
                title: '🏕️ أفضل الرحلات',
                action: TextButton(
                  onPressed: () {},
                  child: const Text('عرض الكل',
                      style: TextStyle(color: GdColors.teal, fontSize: 13)),
                ),
                child: _loading
                    ? _shimmerRow()
                    : _packages.isEmpty
                        ? const SizedBox.shrink()
                        : SizedBox(
                            height: 230,
                            child: _AutoScrollList(
                              itemCount: _packages.length,
                              itemWidth: 182,
                              itemBuilder: (i) => _packageChip(_packages[i]),
                            ),
                          ),
              ),
            ),

            // ── ALL GUIDES LIST ──────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      '🧭 جميع المرشدين',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: GdColors.navy),
                    ),
                    Text(
                      '${_all.length} مرشد',
                      style: const TextStyle(
                          color: GdColors.muted, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),

            _loading
                ? SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (_, __) => _shimmerCard(),
                      childCount: 4,
                    ),
                  )
                : SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (_, i) => Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: GuideCard(
                          guide: _all[i],
                          onTap: () => _openGuide(_all[i]),
                        ),
                      ),
                      childCount: _all.length,
                    ),
                  ),

            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }

  // ── Horizontal guide chip ─────────────────────────────────────
  Widget _guideChip(Guide g) {
    return GestureDetector(
      onTap: () => _openGuide(g),
      child: Container(
        width: 150,
        margin: const EdgeInsets.only(left: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: .07),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Photo
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(16)),
              child: (g.photo != null && g.photo!.isNotEmpty)
                  ? CachedNetworkImage(
                      imageUrl: g.photo!,
                      height: 110,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => _photoPlaceholder(),
                    )
                  : _photoPlaceholder(),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          g.fullName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: GdColors.navy,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (g.isVerified)
                        const Icon(Icons.verified,
                            size: 14, color: GdColors.teal),
                    ],
                  ),
                  const SizedBox(height: 3),
                  if (g.destinations.isNotEmpty)
                    Text(
                      '📍 ${g.destinations.first}',
                      style: const TextStyle(
                          color: GdColors.muted, fontSize: 11),
                      overflow: TextOverflow.ellipsis,
                    ),
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      const Icon(Icons.star, size: 13, color: GdColors.gold),
                      const SizedBox(width: 3),
                      Text(
                        g.rating > 0
                            ? g.rating.toStringAsFixed(1)
                            : 'جديد',
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      const Spacer(),
                      if (g.pricePerDay > 0)
                        Text(
                          '${g.pricePerDay.toStringAsFixed(0)} ر.ع',
                          style: const TextStyle(
                            color: GdColors.teal,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _photoPlaceholder() => Container(
        height: 110,
        width: double.infinity,
        color: const Color(0xFFE2F0EE),
        child: const Icon(Icons.person, size: 40, color: GdColors.teal),
      );

  // ── Horizontal package chip ───────────────────────────────────
  Widget _packageChip(TourPackage p) {
    return GestureDetector(
      onTap: () => _openPackage(p),
      child: Container(
        width: 170,
        margin: const EdgeInsets.only(left: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: .07),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Cover image
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              child: Stack(
                children: [
                  (p.coverImage != null && p.coverImage!.isNotEmpty)
                      ? CachedNetworkImage(
                          imageUrl: p.coverImage!,
                          height: 110,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => _pkgPlaceholder(),
                        )
                      : _pkgPlaceholder(),
                  // Duration badge
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: GdColors.navy.withValues(alpha: .75),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${p.durationDays} ${p.durationDays == 1 ? 'يوم' : 'أيام'}',
                        style: const TextStyle(
                          color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    p.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: GdColors.navy,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '📍 ${p.destination}',
                    style: const TextStyle(color: GdColors.muted, fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.star_rounded, size: 13, color: GdColors.gold),
                      const SizedBox(width: 3),
                      Text(
                        p.rating > 0 ? p.rating.toStringAsFixed(1) : 'جديد',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                      ),
                      const Spacer(),
                      if (p.priceAdult > 0)
                        Text(
                          '${p.priceAdult.toStringAsFixed(0)} ر.ع',
                          style: const TextStyle(
                            color: GdColors.teal,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _pkgPlaceholder() => Container(
        height: 110,
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0f3d3a), Color(0xFF0f7b6c)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: const Icon(Icons.landscape, size: 40, color: Colors.white54),
      );

  void _openPackage(TourPackage p) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => _WebSheet(
        url: 'https://guideon.om/tour-package.html?id=${p.id}',
        title: p.title,
      ),
    ));
  }

  Widget _section({
    required String title,
    required Widget child,
    Widget? action,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: GdColors.navy)),
              if (action != null) action,
            ],
          ),
        ),
        child,
      ],
    );
  }

  // ── Skeleton loaders ──────────────────────────────────────────
  Widget _shimmerRow() => SizedBox(
        height: 230,
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: 4,
          itemBuilder: (_, __) => Container(
            width: 150,
            margin: const EdgeInsets.only(left: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const _Shimmer(height: 230),
          ),
        ),
      );

  Widget _shimmerCard() => const Padding(
        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: _Shimmer(height: 96),
      );

  // ── Navigation ────────────────────────────────────────────────
  void _openSearch() => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const SearchScreen()),
      );

  void _searchDest(String dest) => Navigator.of(context).push(
        MaterialPageRoute(
            builder: (_) => SearchScreen(initialQuery: dest)),
      );

  void _openGuide(Guide g) => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => GuideDetailScreen(guide: g)),
      );

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'صباح الخير';
    if (h < 17) return 'مساء الخير';
    return 'مساء النور';
  }
}

// ── Auto-scroll list ─────────────────────────────────────────────────────
/// Infinite-loop horizontal carousel that scrolls automatically every 3 s.
/// The user can still drag to scroll manually — dragging pauses the timer,
/// which resumes 4 s after the finger lifts.
class _AutoScrollList extends StatefulWidget {
  final int itemCount;
  final double itemWidth;
  final Widget Function(int index) itemBuilder;

  const _AutoScrollList({
    required this.itemCount,
    required this.itemWidth,
    required this.itemBuilder,
  });

  @override
  State<_AutoScrollList> createState() => _AutoScrollListState();
}

class _AutoScrollListState extends State<_AutoScrollList> {
  late final ScrollController _ctrl;
  // We render N * multiplier virtual items so the list feels infinite.
  static const int _mult = 50;
  bool _userScrolling = false;

  @override
  void initState() {
    super.initState();
    _ctrl = ScrollController();
    // Start at the middle so the user can drag left without hitting the edge.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_ctrl.hasClients) return;
      final mid = widget.itemWidth * widget.itemCount * (_mult ~/ 2);
      _ctrl.jumpTo(mid);
      _startAutoScroll();
    });
  }

  void _startAutoScroll() async {
    while (mounted) {
      await Future.delayed(const Duration(seconds: 3));
      if (!mounted || _userScrolling || !_ctrl.hasClients) continue;
      final target = _ctrl.offset + widget.itemWidth + 12;
      await _ctrl.animateTo(
        target,
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOut,
      );
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.itemCount * _mult;
    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (n is ScrollStartNotification && n.dragDetails != null) {
          _userScrolling = true;
        } else if (n is ScrollEndNotification) {
          Future.delayed(const Duration(seconds: 4), () {
            if (mounted) _userScrolling = false;
          });
        }
        return false;
      },
      child: ListView.builder(
        controller: _ctrl,
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: total,
        itemBuilder: (_, i) => widget.itemBuilder(i % widget.itemCount),
      ),
    );
  }
}

// ── Shimmer widget ────────────────────────────────────────────────────────
class _Shimmer extends StatefulWidget {
  final double height;
  const _Shimmer({required this.height});
  @override
  State<_Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<_Shimmer>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
    _anim = Tween<double>(begin: 0.4, end: 0.8).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _anim,
        builder: (_, __) => Container(
          height: widget.height,
          decoration: BoxDecoration(
            color: Color.lerp(
                const Color(0xFFE2E8F0), const Color(0xFFF1F5F9), _anim.value),
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
}

/// In-app WebView — used for tour package pages and booking flows.
class _WebSheet extends StatefulWidget {
  final String url;
  final String title;
  const _WebSheet({required this.url, required this.title});
  @override
  State<_WebSheet> createState() => _WebSheetState();
}

class _WebSheetState extends State<_WebSheet> {
  late final WebViewController _ctrl;
  bool _loading = true;
  double _progress = 0;

  @override
  void initState() {
    super.initState();
    _ctrl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) => setState(() => _progress = p / 100),
        onPageStarted: (_) => setState(() => _loading = true),
        onPageFinished: (_) => setState(() => _loading = false),
      ))
      ..loadRequest(Uri.parse(widget.url));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title,
            style: const TextStyle(fontSize: 14), overflow: TextOverflow.ellipsis),
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
