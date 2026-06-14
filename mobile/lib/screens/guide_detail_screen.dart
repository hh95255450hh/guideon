import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/guide.dart';
import '../theme/app_theme.dart';

class GuideDetailScreen extends StatelessWidget {
  final Guide guide;
  const GuideDetailScreen({super.key, required this.guide});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(guide.fullName)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(60),
              child: (guide.photo != null && guide.photo!.isNotEmpty)
                  ? CachedNetworkImage(
                      imageUrl: guide.photo!,
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
              Text(guide.fullName,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w800)),
              if (guide.isVerified) ...[
                const SizedBox(width: 6),
                const Icon(Icons.verified, color: GdColors.teal, size: 20),
              ],
            ],
          ),
          const SizedBox(height: 6),
          Center(
            child: Text(
              guide.rating > 0
                  ? '⭐ ${guide.rating.toStringAsFixed(1)} · ${guide.totalReviews} تقييم'
                  : 'مرشد جديد',
              style: const TextStyle(color: GdColors.muted),
            ),
          ),
          const SizedBox(height: 20),
          if (guide.bio.isNotEmpty) ...[
            const _SectionTitle('نبذة'),
            Text(guide.bio, style: const TextStyle(height: 1.6)),
            const SizedBox(height: 16),
          ],
          if (guide.languages.isNotEmpty)
            _chips('اللغات', guide.languages),
          if (guide.specialisations.isNotEmpty)
            _chips('التخصّصات', guide.specialisations),
          if (guide.destinations.isNotEmpty)
            _chips('الوجهات', guide.destinations),
          const SizedBox(height: 24),
          if (guide.pricePerDay > 0)
            Center(
              child: Text('${guide.pricePerDay} ر.ع / يوم',
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: GdColors.teal)),
            ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: () => _openBooking(context),
            icon: const Icon(Icons.event_available),
            label: const Text('احجز الآن'),
          ),
        ],
      ),
    );
  }

  // Booking + payment still flow through the web checkout for now (Thawani);
  // deep-link into the existing, fully-working web booking page.
  Future<void> _openBooking(BuildContext context) async {
    final uri =
        Uri.parse('https://guideon.om/guide-profile.html?id=${guide.id}');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تعذّر فتح صفحة الحجز.')),
        );
      }
    }
  }

  Widget _ph() => Container(
        width: 120,
        height: 120,
        color: const Color(0xFFE2F0EE),
        child: const Icon(Icons.person, size: 56, color: GdColors.teal),
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
