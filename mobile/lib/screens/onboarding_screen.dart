import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../theme/app_theme.dart';
import 'home_shell.dart';
import 'login_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _ctrl = PageController();
  int _page = 0;

  static const _slides = [
    _Slide(
      icon: Icons.travel_explore,
      iconColor: Color(0xFFFFD166),
      title: 'اكتشف عُمان',
      subtitle: 'تصفّح مئات المرشدين المحليين المعتمدين في كل\nولاية وجهة في السلطنة',
      bg1: Color(0xFF0f1c3e),
      bg2: Color(0xFF0f3d3a),
    ),
    _Slide(
      icon: Icons.event_available_rounded,
      iconColor: Color(0xFF7FDBCA),
      title: 'احجز بسهولة',
      subtitle: 'اختر مرشدك، حدد التاريخ، وأكمل الدفع\nبأمان في خطوات بسيطة',
      bg1: Color(0xFF0f3d3a),
      bg2: Color(0xFF0a4a3a),
    ),
    _Slide(
      icon: Icons.landscape_rounded,
      iconColor: Color(0xFFC8A94A),
      title: 'استمتع برحلتك',
      subtitle: 'تجارب سياحية أصيلة مع خبراء يعرفون\nكل زاوية في عُمان',
      bg1: Color(0xFF0a2e28),
      bg2: Color(0xFF0f1c3e),
    ),
  ];

  Future<void> _finish() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_done', true);
  }

  void _goHome() async {
    await _finish();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const HomeShell()),
    );
  }

  void _goGuideLogin() async {
    await _finish();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  void _next() {
    if (_page < _slides.length - 1) {
      _ctrl.nextPage(
        duration: const Duration(milliseconds: 350),
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
    final isLast = _page == _slides.length - 1;
    final slide = _slides[_page];

    return Scaffold(
      body: Stack(
        children: [
          // ── Animated gradient background ───────────────────────
          AnimatedContainer(
            duration: const Duration(milliseconds: 400),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [slide.bg1, slide.bg2],
              ),
            ),
          ),

          // ── Decorative circles ─────────────────────────────────
          Positioned(
            top: -80,
            right: -80,
            child: _Circle(size: 260, color: Colors.white.withValues(alpha: .04)),
          ),
          Positioned(
            bottom: 200,
            left: -60,
            child: _Circle(size: 200, color: Colors.white.withValues(alpha: .03)),
          ),

          // ── Content ────────────────────────────────────────────
          SafeArea(
            child: Column(
              children: [
                // Skip button
                Align(
                  alignment: AlignmentDirectional.topEnd,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(0, 12, 16, 0),
                    child: isLast
                        ? const SizedBox()
                        : TextButton(
                            onPressed: _goHome,
                            child: const Text('تخطّى',
                                style: TextStyle(
                                    color: Colors.white60, fontSize: 14)),
                          ),
                  ),
                ),

                // PageView slides
                Expanded(
                  child: PageView.builder(
                    controller: _ctrl,
                    onPageChanged: (i) => setState(() => _page = i),
                    itemCount: _slides.length,
                    itemBuilder: (_, i) => _SlidePage(slide: _slides[i]),
                  ),
                ),

                // ── Dots ──────────────────────────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(_slides.length, (i) {
                    final active = i == _page;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: active ? 24 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: active ? GdColors.gold : Colors.white30,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 32),

                // ── Buttons ───────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
                  child: isLast ? _roleButtons() : _nextButton(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _nextButton() => SizedBox(
        width: double.infinity,
        height: 54,
        child: ElevatedButton(
          onPressed: _next,
          style: ElevatedButton.styleFrom(
            backgroundColor: GdColors.teal,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16)),
            elevation: 0,
          ),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('التالي', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              SizedBox(width: 8),
              Icon(Icons.arrow_back_ios_new_rounded, size: 16),
            ],
          ),
        ),
      );

  Widget _roleButtons() => Column(
        children: [
          // Tourist
          SizedBox(
            width: double.infinity,
            height: 54,
            child: ElevatedButton.icon(
              onPressed: _goHome,
              icon: const Icon(Icons.luggage_rounded, size: 22),
              label: const Text('أبدأ كسائح',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              style: ElevatedButton.styleFrom(
                backgroundColor: GdColors.teal,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                elevation: 0,
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Guide
          SizedBox(
            width: double.infinity,
            height: 54,
            child: OutlinedButton.icon(
              onPressed: _goGuideLogin,
              icon: const Icon(Icons.badge_rounded, size: 22),
              label: const Text('أنا مرشد سياحي',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: const BorderSide(color: Colors.white38, width: 1.5),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
        ],
      );
}

// ── Single slide page ────────────────────────────────────────────────────────
class _SlidePage extends StatelessWidget {
  final _Slide slide;
  const _SlidePage({required this.slide});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Icon container with glow
          Container(
            width: 140,
            height: 140,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: slide.iconColor.withValues(alpha: .12),
              border: Border.all(
                  color: slide.iconColor.withValues(alpha: .25), width: 2),
              boxShadow: [
                BoxShadow(
                  color: slide.iconColor.withValues(alpha: .2),
                  blurRadius: 40,
                  spreadRadius: 5,
                ),
              ],
            ),
            child: Icon(slide.icon, size: 64, color: slide.iconColor),
          ),
          const SizedBox(height: 40),
          Text(
            slide.title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            slide.subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 15,
              height: 1.7,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Data model ───────────────────────────────────────────────────────────────
class _Slide {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final Color bg1;
  final Color bg2;
  const _Slide({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.bg1,
    required this.bg2,
  });
}

// ── Decorative circle ────────────────────────────────────────────────────────
class _Circle extends StatelessWidget {
  final double size;
  final Color color;
  const _Circle({required this.size, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      );
}
