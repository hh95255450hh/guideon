import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/auth_service.dart';
import '../theme/app_theme.dart';
import 'home_shell.dart';
import 'onboarding_screen.dart';

/// Splash screen shown while [AuthService.restore] and first-run check resolve.
/// Routes to OnboardingScreen on first ever launch, or HomeShell otherwise.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  bool _ready = false;
  bool _firstRun = false;

  @override
  void initState() {
    super.initState();
    _checkFirstRun();
  }

  Future<void> _checkFirstRun() async {
    final prefs = await SharedPreferences.getInstance();
    final done = prefs.getBool('onboarding_done') ?? false;
    if (mounted) setState(() { _firstRun = !done; _ready = true; });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    // Both auth restore and first-run check must complete before navigating.
    if (_ready && !auth.loading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) =>
                _firstRun ? const OnboardingScreen() : const HomeShell(),
          ),
        );
      });
    }

    return Scaffold(
      backgroundColor: GdColors.navy,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Guideon logo on white card (colored logo on dark bg)
            Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: .2),
                    blurRadius: 32,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Image.asset(
                  'assets/images/app_icon.png',
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Icon(
                    Icons.travel_explore,
                    size: 60,
                    color: GdColors.teal,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'دليلك السياحي في عُمان',
              style: TextStyle(color: Colors.white.withValues(alpha: .55), fontSize: 14),
            ),
            const SizedBox(height: 40),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                  color: GdColors.teal, strokeWidth: 2.5),
            ),
          ],
        ),
      ),
    );
  }
}
