import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// A polished, reusable empty-state — one visual language for "nothing here yet"
/// across every screen (search, bookings, wishlist, …). Replaces the ad-hoc
/// centered grey `Text('...')` blocks scattered through the app.
class GdEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const GdEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 84,
              height: 84,
              decoration: const BoxDecoration(
                color: Color(0xFFEAF6F3),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 40, color: GdColors.teal),
            ),
            const SizedBox(height: 18),
            Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: GdColors.navy)),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(subtitle!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: GdColors.muted, height: 1.5)),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 20),
              OutlinedButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

/// A consistent error-state with a retry affordance.
class GdErrorState extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;

  const GdErrorState({super.key, required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 84,
              height: 84,
              decoration: const BoxDecoration(
                color: Color(0xFFFDECEC),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.cloud_off_rounded,
                  size: 40, color: GdColors.danger),
            ),
            const SizedBox(height: 18),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: GdColors.navy)),
            if (onRetry != null) ...[
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('إعادة المحاولة'),
                style: ElevatedButton.styleFrom(
                    minimumSize: const Size(180, 48)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
