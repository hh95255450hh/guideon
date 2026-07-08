import 'package:flutter/material.dart';

import '../models/guide.dart';
import '../services/api.dart';
import '../services/guide_service.dart';
import '../theme/app_theme.dart';
import '../widgets/guide_card.dart';
import 'guide_detail_screen.dart';

class SearchScreen extends StatefulWidget {
  final String? initialQuery;
  const SearchScreen({super.key, this.initialQuery});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  late final TextEditingController _ctrl;
  List<Guide> _guides = [];
  bool _loading = true;
  String? _error;
  String _activeFilter = 'all';
  // 'guide' | 'company' — the backend's /api/guides?type= param decides which
  // provider kind to search; without this, companies never appear anywhere
  // in the app since this screen is the main discovery/search surface.
  String _providerType = 'guide';

  final List<Map<String, String>> _filters = [
    {'key': 'all',     'label': 'الكل'},
    {'key': 'top',     'label': '⭐ الأعلى'},
    {'key': 'cheap',   'label': '💰 الأرخص'},
    {'key': 'muscat',  'label': 'مسقط'},
    {'key': 'salalah', 'label': 'صلالة'},
    {'key': 'nizwa',   'label': 'نزوى'},
  ];

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.initialQuery ?? '');
    _load();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final q = _ctrl.text.trim().isNotEmpty ? _ctrl.text.trim()
          : (_activeFilter != 'all' && _activeFilter != 'top' && _activeFilter != 'cheap')
              ? _activeFilter : null;
      final g = await GuideService.search(
          query: q, type: _providerType == 'company' ? 'company' : null, limit: 30);
      List<Guide> sorted = g;
      if (_activeFilter == 'top') {
        sorted = [...g]..sort((a, b) => b.rating.compareTo(a.rating));
      } else if (_activeFilter == 'cheap') {
        sorted = [...g]..sort((a, b) => (a.pricePerDay > 0 ? a.pricePerDay : 9999)
            .compareTo(b.pricePerDay > 0 ? b.pricePerDay : 9999));
      }
      if (!mounted) return;
      setState(() { _guides = sorted; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = friendlyError(e); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GdColors.sand,
      appBar: AppBar(
        backgroundColor: GdColors.navy,
        foregroundColor: Colors.white,
        title: TextField(
          controller: _ctrl,
          textInputAction: TextInputAction.search,
          onSubmitted: (_) => _load(),
          style: const TextStyle(color: Colors.white, fontSize: 15),
          decoration: InputDecoration(
            hintText: 'ابحث عن وجهة أو مرشد…',
            hintStyle: const TextStyle(color: Colors.white60, fontSize: 14),
            border: InputBorder.none,
            suffixIcon: _ctrl.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, color: Colors.white60, size: 18),
                    onPressed: () { _ctrl.clear(); _load(); },
                  )
                : null,
          ),
        ),
        actions: [
          IconButton(icon: const Icon(Icons.search, color: Colors.white), onPressed: _load),
        ],
      ),
      body: Column(children: [
        // Provider-type toggle — guides vs. companies (two separate result
        // pools on the backend; without this switch companies are unreachable
        // from search).
        Container(
          color: GdColors.navy,
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
          child: Row(
            children: [
              Expanded(child: _typeTab('guide', '🧭 مرشدون')),
              const SizedBox(width: 8),
              Expanded(child: _typeTab('company', '🏢 شركات')),
            ],
          ),
        ),
        // Filter pills
        Container(
          color: GdColors.navy,
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _filters.map((f) {
                final active = _activeFilter == f['key'];
                return GestureDetector(
                  onTap: () { setState(() => _activeFilter = f['key']!); _load(); },
                  child: Container(
                    margin: const EdgeInsets.only(left: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? GdColors.gold : Colors.white12,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: active ? GdColors.gold : Colors.white30),
                    ),
                    child: Text(f['label']!,
                      style: TextStyle(
                        color: active ? GdColors.navy : Colors.white,
                        fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
        Expanded(child: _body()),
      ]),
    );
  }

  Widget _typeTab(String type, String label) {
    final active = _providerType == type;
    return GestureDetector(
      onTap: active
          ? null
          : () {
              setState(() => _providerType = type);
              _load();
            },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          color: active ? GdColors.teal : Colors.white12,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(label,
            textAlign: TextAlign.center,
            style: TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: active ? FontWeight.w800 : FontWeight.w600)),
      ),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator(color: GdColors.teal));
    if (_error != null) return Center(
      child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.wifi_off, size: 56, color: GdColors.muted),
        const SizedBox(height: 14),
        Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: GdColors.muted)),
        const SizedBox(height: 18),
        FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('إعادة المحاولة')),
      ])),
    );
    if (_guides.isEmpty) return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.search_off, size: 56, color: GdColors.muted),
      const SizedBox(height: 12),
      Text('لا نتائج', style: const TextStyle(color: GdColors.muted, fontSize: 15)),
    ]));
    return RefreshIndicator(
      onRefresh: _load, color: GdColors.teal,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _guides.length,
        itemBuilder: (_, i) => GuideCard(
          guide: _guides[i],
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => GuideDetailScreen(guide: _guides[i]))),
        ),
      ),
    );
  }
}
