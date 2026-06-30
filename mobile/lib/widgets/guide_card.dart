import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../models/guide.dart';
import '../theme/app_theme.dart';

class GuideCard extends StatelessWidget {
  final Guide guide;
  final VoidCallback onTap;
  const GuideCard({super.key, required this.guide, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: .06),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Avatar
              _avatar(),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name + verified
                    Row(children: [
                      Expanded(
                        child: Text(
                          guide.fullName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                            color: GdColors.navy,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (guide.isVerified) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: GdColors.teal.withValues(alpha: .12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.verified, size: 11, color: GdColors.teal),
                            SizedBox(width: 3),
                            Text('موثّق', style: TextStyle(
                              fontSize: 10, color: GdColors.teal, fontWeight: FontWeight.w700)),
                          ]),
                        ),
                      ],
                    ]),
                    const SizedBox(height: 4),
                    // Destinations
                    if (guide.destinations.isNotEmpty)
                      Text(
                        '📍 ${guide.destinations.take(2).join(' · ')}',
                        style: const TextStyle(color: GdColors.muted, fontSize: 12),
                        overflow: TextOverflow.ellipsis,
                      ),
                    const SizedBox(height: 6),
                    // Specialisations chips
                    if (guide.specialisations.isNotEmpty)
                      Wrap(spacing: 5, runSpacing: 4, children: guide.specialisations.take(2).map((s) =>
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE2F0EE),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(s, style: const TextStyle(
                            fontSize: 10, color: GdColors.teal, fontWeight: FontWeight.w600)),
                        )
                      ).toList()),
                    const SizedBox(height: 8),
                    // Rating + price row
                    Row(children: [
                      const Icon(Icons.star_rounded, size: 15, color: GdColors.gold),
                      const SizedBox(width: 3),
                      Text(
                        guide.rating > 0
                            ? '${guide.rating.toStringAsFixed(1)}  (${guide.totalReviews})'
                            : 'مرشد جديد',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: GdColors.navy),
                      ),
                      const Spacer(),
                      if (guide.pricePerDay > 0) ...[
                        Text(
                          '${guide.pricePerDay.toStringAsFixed(0)} ر.ع',
                          style: const TextStyle(
                            fontWeight: FontWeight.w800, color: GdColors.teal, fontSize: 14),
                        ),
                        const Text(' /يوم',
                          style: TextStyle(color: GdColors.muted, fontSize: 10)),
                      ],
                    ]),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _avatar() {
    const size = 72.0;
    if (guide.photo != null && guide.photo!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: CachedNetworkImage(
          imageUrl: guide.photo!,
          width: size, height: size, fit: BoxFit.cover,
          placeholder: (_, __) => _ph(size),
          errorWidget: (_, __, ___) => _ph(size),
        ),
      );
    }
    return _ph(size);
  }

  Widget _ph(double size) => Container(
    width: size, height: size,
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFF0f7b6c), Color(0xFF1a9e8b)],
        begin: Alignment.topLeft, end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(14),
    ),
    child: const Icon(Icons.person, color: Colors.white, size: 32),
  );
}
