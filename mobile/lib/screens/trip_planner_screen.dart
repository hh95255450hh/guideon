import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../models/trip_plan.dart';
import '../services/api.dart';
import '../services/guide_service.dart';
import '../services/trip_service.dart';
import '../theme/app_theme.dart';
import 'guide_detail_screen.dart';

/// AI trip planner: the tourist describes their trip and gets a day-by-day
/// itinerary with a matched Guideon guide for each day.
class TripPlannerScreen extends StatefulWidget {
  const TripPlannerScreen({super.key});

  @override
  State<TripPlannerScreen> createState() => _TripPlannerScreenState();
}

class _TripPlannerScreenState extends State<TripPlannerScreen> {
  static const _interests = <String>[
    'شواطئ وغوص',
    'جبال ومغامرات',
    'صحراء وتخييم',
    'تاريخ وتراث',
    'رحلة رومانسيّة',
    'تصوير',
    'طعام محلّي',
    'عائلي',
  ];

  final _request = TextEditingController();
  final _days = TextEditingController();
  final _budget = TextEditingController();
  final _selected = <String>{};

  bool _loading = false;
  String? _error;
  TripPlan? _plan;

  @override
  void dispose() {
    _request.dispose();
    _days.dispose();
    _budget.dispose();
    super.dispose();
  }

  Future<void> _plRun() async {
    final req = _request.text.trim();
    if (req.isEmpty && _selected.isEmpty) {
      setState(() => _error = 'صف رحلتك أو اختر اهتماماً واحداً على الأقل.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
      _plan = null;
    });
    try {
      final plan = await TripService.plan(
        request: req,
        days: int.tryParse(_days.text.trim()),
        interests: _selected.join('، '),
        budget: _budget.text,
      );
      if (!mounted) return;
      setState(() => _plan = plan);
    } catch (e) {
      if (!mounted) return;
      // Never surface a raw Dart exception to the user — route everything
      // through the friendly bilingual helper.
      setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openGuide(String id) async {
    if (id.isEmpty) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );
    try {
      final g = await GuideService.byId(id);
      if (!mounted) return;
      Navigator.of(context).pop(); // close the loader
      if (g != null) {
        Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => GuideDetailScreen(guide: g)));
      } else {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('تعذّر فتح ملف المرشد.')));
      }
    } catch (_) {
      if (!mounted) return;
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('خطّط رحلتك ✨')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'صِف رحلتك، وسيبني لك الذكاء الاصطناعي برنامجاً يوميّاً كاملاً مع أفضل المرشدين المرخّصين.',
            style: TextStyle(color: GdColors.muted, height: 1.5),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _request,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'مثال: ٤ أيّام في عُمان، أحبّ الجبال والتاريخ، مع عائلتي، ميزانيّة متوسّطة.',
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _days,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(hintText: 'عدد الأيّام'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _budget,
                  decoration: const InputDecoration(hintText: 'الميزانيّة (اختياري)'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _interests.map((tag) {
              final on = _selected.contains(tag);
              return FilterChip(
                label: Text(tag),
                selected: on,
                onSelected: (v) => setState(
                    () => v ? _selected.add(tag) : _selected.remove(tag)),
                selectedColor: GdColors.teal.withValues(alpha: .15),
                checkmarkColor: GdColors.teal,
              );
            }).toList(),
          ),
          const SizedBox(height: 18),
          ElevatedButton.icon(
            onPressed: _loading ? null : _plRun,
            icon: _loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.auto_awesome),
            label: Text(_loading ? 'جارٍ التخطيط…' : 'خطّط رحلتي'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: GdColors.danger.withValues(alpha: .08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(_error!, style: const TextStyle(color: GdColors.danger)),
            ),
          ],
          if (_plan != null) ...[
            const SizedBox(height: 24),
            _PlanView(plan: _plan!, onGuideTap: _openGuide),
          ],
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _PlanView extends StatelessWidget {
  final TripPlan plan;
  final void Function(String guideId) onGuideTap;
  const _PlanView({required this.plan, required this.onGuideTap});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(plan.title,
            style: const TextStyle(
                fontSize: 20, fontWeight: FontWeight.w800, color: GdColors.navy)),
        if (plan.summary.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(plan.summary,
              style: const TextStyle(color: GdColors.muted, height: 1.5)),
        ],
        const SizedBox(height: 16),
        for (final d in plan.days) _dayCard(context, d),
        if (plan.totalEstimatedOMR > 0) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: GdColors.teal,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('التكلفة التقديريّة الإجماليّة',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                Text('${plan.totalEstimatedOMR.toStringAsFixed(0)} ر.ع',
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18)),
              ],
            ),
          ),
        ],
        if (plan.tips.isNotEmpty) ...[
          const SizedBox(height: 18),
          const Text('نصائح',
              style: TextStyle(fontWeight: FontWeight.w800, color: GdColors.navy)),
          const SizedBox(height: 8),
          for (final t in plan.tips)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('• ', style: TextStyle(color: GdColors.gold)),
                  Expanded(child: Text(t, style: const TextStyle(height: 1.5))),
                ],
              ),
            ),
        ],
      ],
    );
  }

  Widget _dayCard(BuildContext context, TripDay d) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE7EAEE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: const BoxDecoration(
              color: GdColors.sand,
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: GdColors.teal,
                  child: Text('${d.day}',
                      style: const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w800)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(d.theme,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, color: GdColors.navy)),
                      if (d.governorate.isNotEmpty)
                        Text(d.governorate,
                            style: const TextStyle(
                                color: GdColors.muted, fontSize: 12)),
                    ],
                  ),
                ),
                if (d.estimatedCostOMR > 0)
                  Text('${d.estimatedCostOMR.toStringAsFixed(0)} ر.ع',
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, color: GdColors.teal)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final a in d.activities)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.place_outlined,
                            size: 16, color: GdColors.gold),
                        const SizedBox(width: 6),
                        Expanded(child: Text(a, style: const TextStyle(height: 1.4))),
                      ],
                    ),
                  ),
                if (d.suggestedGuideName.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  InkWell(
                    onTap: () => onGuideTap(d.suggestedGuideId),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: GdColors.sand,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: const Color(0xFFE7EAEE),
                            backgroundImage: d.suggestedGuidePhoto.isNotEmpty
                                ? NetworkImage(d.suggestedGuidePhoto)
                                : null,
                            child: d.suggestedGuidePhoto.isEmpty
                                ? const Icon(Icons.person, color: GdColors.muted)
                                : null,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('المرشد المقترح',
                                    style: TextStyle(
                                        fontSize: 11, color: GdColors.muted)),
                                Text(d.suggestedGuideName,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_left, color: GdColors.muted),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
