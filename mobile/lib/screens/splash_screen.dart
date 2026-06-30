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
            // Logo circle
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: GdColors.teal.withValues(alpha: .15),
                border: Border.all(
                    color: GdColors.teal.withValues(alpha: .4), width: 2),
              ),
              child: const Icon(Icons.travel_explore,
                  size: 52, color: GdColors.teal),
            ),
            const SizedBox(height: 20),
            const Text(
              'Guideon',
              style: TextStyle(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'دليلك السياحي في عُمان',
              style: TextStyle(color: Colors.white60, fontSize: 14),
            ),
            const SizedBox(height: 36),
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
