import 'package:flutter/material.dart';

import '../models/guide.dart';
import '../services/api.dart';
import '../services/guide_service.dart';
import '../theme/app_theme.dart';
import '../widgets/guide_card.dart';
import 'guide_detail_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _ctrl = TextEditingController();
  List<Guide> _guides = [];
  bool _loading = true;
  String? _error;
  String _diag = 'بدء v3 · 1.0.0+3';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _diag = 'جارٍ التحميل من $_endpoint …';
    });
    try {
      final g = await GuideService.search(query: _ctrl.text);
      if (!mounted) return;
      setState(() {
        _guides = g;
        _diag = 'تم ✓ عدد المرشدين: ${g.length}';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyError(e);
        _diag = 'خطأ: ${e.toString()}';
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static const String _endpoint = 'guideon.om/api/guides';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ابحث عن مرشد')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _ctrl,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _load(),
              decoration: InputDecoration(
                hintText: 'الوجهة، اللغة، أو التخصّص…',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward),
                  onPressed: _load,
                ),
              ),
            ),
          ),
          // TEMP diagnostic banner — always visible, shows the live load state.
          Container(
            width: double.infinity,
            color: const Color(0xFFFFF3CD),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Text('🔎 $_diag',
                style: const TextStyle(
                    fontSize: 12, color: Color(0xFF8A6D00)),
                textAlign: TextAlign.center),
          ),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _body() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return _message(_error!, retry: true);
    }
    if (_guides.isEmpty) {
      return _message('لا توجد نتائج مطابقة.\nجرّب كلمة بحث أخرى.');
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: _guides.length,
        itemBuilder: (_, i) => GuideCard(
          guide: _guides[i],
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
                builder: (_) => GuideDetailScreen(guide: _guides[i])),
          ),
        ),
      ),
    );
  }

  Widget _message(String text, {bool retry = false}) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(retry ? Icons.wifi_off : Icons.travel_explore,
                  size: 56, color: retry ? GdColors.danger : GdColors.teal),
              const SizedBox(height: 14),
              Text(text,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: GdColors.navy,
                      fontSize: 16,
                      fontWeight: FontWeight.w600)),
              if (retry) ...[
                const SizedBox(height: 18),
                FilledButton.icon(
                    onPressed: _load,
                    icon: const Icon(Icons.refresh),
                    label: const Text('إعادة المحاولة')),
              ],
              const SizedBox(height: 20),
              const Text('v3 · 1.0.0+3',
                  style: TextStyle(color: GdColors.muted, fontSize: 11)),
            ],
          ),
        ),
      );
}
