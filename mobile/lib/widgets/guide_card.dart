import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../models/guide.dart';
import '../theme/app_theme.dart';

class GuideCard extends StatelessWidget {
  final Guide guide;
  final VoidCallback onTap;
  const GuideCard({super.key, required this.guide, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              _avatar(),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            guide.fullName,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 15),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (guide.isVerified) ...[
                          const SizedBox(width: 4),
                          const Icon(Icons.verified,
                              size: 16, color: GdColors.teal),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    if (guide.destinations.isNotEmpty)
                      Text('📍 ${guide.destinations.take(2).join('، ')}',
                          style: const TextStyle(
                              color: GdColors.muted, fontSize: 12.5)),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.star,
                            size: 15, color: GdColors.gold),
                        const SizedBox(width: 3),
                        Text(
                          guide.rating > 0
                              ? '${guide.rating.toStringAsFixed(1)} (${guide.totalReviews})'
                              : 'جديد',
                          style: const TextStyle(fontSize: 12.5),
                        ),
                        const Spacer(),
                        if (guide.pricePerDay > 0)
                          Text('${guide.pricePerDay} ر.ع/يوم',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: GdColors.teal,
                                  fontSize: 13)),
                      ],
                    ),
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
    const size = 64.0;
    if (guide.photo != null && guide.photo!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: CachedNetworkImage(
          imageUrl: guide.photo!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          placeholder: (_, __) => _ph(size),
          errorWidget: (_, __, ___) => _ph(size),
        ),
      );
    }
    return _ph(size);
  }

  Widget _ph(double size) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: const Color(0xFFE2F0EE),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Icon(Icons.person, color: GdColors.teal, size: 30),
      );
}
