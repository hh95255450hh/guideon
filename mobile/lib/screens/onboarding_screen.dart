import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../theme/app_theme.dart';
import 'home_shell.dart';
import 'login_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING SCREEN
// ─────────────────────────────────────────────────────────────────────────────
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with TickerProviderStateMixin {
  final _pageCtrl = PageController();
  int _page = 0;

  // Animation controllers
  late AnimationController _iconCtrl;   // float animation for the icon
  late AnimationController _fadeCtrl;   // fade in on page change
  late Animation<double> _float;
  late Animation<double> _fade;

  static const _slides = [
    _SlideData(
      gradient: [Color(0xFF0D1B4B), Color(0xFF0D3B35)],
      accent: Color(0xFFFFC857),
      icon: Icons.travel_explore_rounded,
      badge: '🗺️',
      titleLine1: 'اكتشف عُمان',
      titleLine2: 'الجميلة',
      body:
          'تصفّح مئات المرشدين المحليين المعتمدين في كل ولاية، من مسقط إلى صلالة ومن نزوى إلى مسندم.',
      stat1: '١٠٠+', stat1Label: 'مرشد معتمد',
      stat2: '٢٥+', stat2Label: 'وجهة',
    ),
    _SlideData(
      gradient: [Color(0xFF0D3B35), Color(0xFF0A2340)],
      accent: Color(0xFF6ECFC4),
      icon: Icons.event_available_rounded,
      badge: '✅',
      titleLine1: 'احجز في',
      titleLine2: 'دقيقتين',
      body:
          'اختر مرشدك، حدد التاريخ والمجموعة، وأتمّ الدفع الآمن. كل شيء في مكان واحد.',
      stat1: '٩٨٪', stat1Label: 'رضا العملاء',
      stat2: '٢٤/٧', stat2Label: 'دعم فوري',
    ),
    _SlideData(
      gradient: [Color(0xFF0A2340), Color(0xFF0D1B4B)],
      accent: Color(0xFFC8A94A),
      icon: Icons.landscape_rounded,
      badge: '⭐',
      titleLine1: 'تجارب لا',
      titleLine2: 'تُنسى',
      body:
          'خبراء محليون يعرفون كل زاوية في السلطنة — استمتع برحلة أصيلة بعيداً عن السياحة التقليدية.',
      stat1: '٤.٩', stat1Label: 'متوسط التقييم',
      stat2: '٥٠٠+', stat2Label: 'رحلة مكتملة',
    ),
  ];

  @override
  void initState() {
    super.initState();

    _iconCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    )..repeat(reverse: true);

    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );

    _float = Tween<double>(begin: -10, end: 10).animate(
      CurvedAnimation(parent: _iconCtrl, curve: Curves.easeInOut),
    );

    _fade = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _fadeCtrl.forward();
  }

  @override
  void dispose() {
    _iconCtrl.dispose();
    _fadeCtrl.dispose();
    _pageCtrl.dispose();
    super.dispose();
  }

  void _onPageChange(int i) {
    _fadeCtrl.forward(from: 0);
    setState(() => _page = i);
  }

  Future<void> _done() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_done', true);
  }

  void _goHome() async {
    await _done();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (_, a, __) => const HomeShell(),
        transitionsBuilder: (_, a, __, child) =>
            FadeTransition(opacity: a, child: child),
        transitionDuration: const Duration(milliseconds: 500),
      ),
    );
  }

  void _goGuide() async {
    await _done();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (_, a, __) => const LoginScreen(),
        transitionsBuilder: (_, a, __, child) =>
            FadeTransition(opacity: a, child: child),
        transitionDuration: const Duration(milliseconds: 500),
      ),
    );
  }

  void _next() => _pageCtrl.nextPage(
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeInOut,
      );

  @override
  Widget build(BuildContext context) {
    final slide = _slides[_page];
    final isLast = _page == _slides.length - 1;

    return Scaffold(
      body: AnimatedContainer(
        duration: const Duration(milliseconds: 500),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: slide.gradient,
          ),
        ),
        child: Stack(
          children: [
            // ── Decorative arcs ────────────────────────────────────
            Positioned.fill(
              child: CustomPaint(
                painter: _ArcPainter(
                    color: slide.accent.withValues(alpha: .06), page: _page),
              ),
            ),

            // ── Subtle grid dots ───────────────────────────────────
            Positioned.fill(
              child: CustomPaint(
                painter: _DotGridPainter(
                    color: Colors.white.withValues(alpha: .04)),
              ),
            ),

            // ── Page content ───────────────────────────────────────
            SafeArea(
              child: Column(
                children: [
                  // Top row: logo + skip
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Brand mark
                        Row(children: [
                          Container(
                            width: 30,
                            height: 30,
                            decoration: BoxDecoration(
                              color: slide.accent.withValues(alpha: .2),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(Icons.travel_explore,
                                size: 18, color: slide.accent),
                          ),
                          const SizedBox(width: 8),
                          const Text('Guideon',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800)),
                        ]),
                        if (!isLast)
                          GestureDetector(
                            onTap: _goHome,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: .1),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                    color: Colors.white.withValues(alpha: .2)),
                              ),
                              child: const Text('تخطّى',
                                  style: TextStyle(
                                      color: Colors.white70, fontSize: 13)),
                            ),
                          ),
                      ],
                    ),
                  ),

                  // PageView
                  Expanded(
                    child: PageView.builder(
                      controller: _pageCtrl,
                      onPageChanged: _onPageChange,
                      itemCount: _slides.length,
                      itemBuilder: (_, i) => _SlideContent(
                        slide: _slides[i],
                        float: _float,
                        fade: i == _page ? _fade : const AlwaysStoppedAnimation(1),
                      ),
                    ),
                  ),

                  // ── Bottom area ─────────────────────────────────
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 36),
                    child: Column(
                      children: [
                        // Page dots
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(_slides.length, (i) {
                            final active = i == _page;
                            return AnimatedContainer(
                              duration: const Duration(milliseconds: 300),
                              margin: const EdgeInsets.symmetric(horizontal: 4),
                              width: active ? 28 : 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color:
                                    active ? slide.accent : Colors.white24,
                                borderRadius: BorderRadius.circular(4),
                              ),
                            );
                          }),
                        ),
                        const SizedBox(height: 28),

                        if (!isLast) ...[
                          // Next button
                          _PrimaryButton(
                            label: 'التالي',
                            icon: Icons.arrow_back_ios_rounded,
                            color: slide.accent,
                            onTap: _next,
                          ),
                        ] else ...[
                          // Role selection
                          _PrimaryButton(
                            label: 'أبدأ كسائح',
                            icon: Icons.luggage_rounded,
                            color: slide.accent,
                            onTap: _goHome,
                          ),
                          const SizedBox(height: 12),
                          _OutlineButton(
                            label: 'أنا مرشد سياحي',
                            icon: Icons.badge_rounded,
                            onTap: _goGuide,
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE CONTENT
// ─────────────────────────────────────────────────────────────────────────────
class _SlideContent extends StatelessWidget {
  final _SlideData slide;
  final Animation<double> float;
  final Animation<double> fade;

  const _SlideContent({
    required this.slide,
    required this.float,
    required this.fade,
  });

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: fade,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          children: [
            const SizedBox(height: 16),

            // ── Floating icon ────────────────────────────────────
            Expanded(
              flex: 5,
              child: Center(
                child: AnimatedBuilder(
                  animation: float,
                  builder: (_, child) => Transform.translate(
                    offset: Offset(0, float.value),
                    child: child,
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Outer glow ring
                      Container(
                        width: 200,
                        height: 200,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            colors: [
                              slide.accent.withValues(alpha: .18),
                              slide.accent.withValues(alpha: 0),
                            ],
                          ),
                        ),
                      ),
                      // Inner circle
                      Container(
                        width: 148,
                        height: 148,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: slide.accent.withValues(alpha: .12),
                          border: Border.all(
                            color: slide.accent.withValues(alpha: .3),
                            width: 1.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: slide.accent.withValues(alpha: .25),
                              blurRadius: 48,
                              spreadRadius: 4,
                            ),
                          ],
                        ),
                        child: Icon(slide.icon, size: 72, color: slide.accent),
                      ),
                      // Badge emoji
                      Positioned(
                        top: 22,
                        right: 22,
                        child: Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: .15),
                                blurRadius: 10,
                              )
                            ],
                          ),
                          child: Center(
                            child: Text(slide.badge,
                                style: const TextStyle(fontSize: 18)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ── Text content ─────────────────────────────────────
            Expanded(
              flex: 4,
              child: Column(
                children: [
                  // Title
                  RichText(
                    textAlign: TextAlign.center,
                    text: TextSpan(
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 34,
                        fontWeight: FontWeight.w800,
                        height: 1.15,
                      ),
                      children: [
                        TextSpan(text: slide.titleLine1),
                        TextSpan(
                          text: '\n${slide.titleLine2}',
                          style: TextStyle(color: slide.accent),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Body
                  Text(
                    slide.body,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white60,
                      fontSize: 14.5,
                      height: 1.75,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // ── Stats row ──────────────────────────────────
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _StatChip(
                        value: slide.stat1,
                        label: slide.stat1Label,
                        accent: slide.accent,
                      ),
                      Container(
                        width: 1,
                        height: 32,
                        margin: const EdgeInsets.symmetric(horizontal: 20),
                        color: Colors.white12,
                      ),
                      _StatChip(
                        value: slide.stat2,
                        label: slide.stat2Label,
                        accent: slide.accent,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CHIP
// ─────────────────────────────────────────────────────────────────────────────
class _StatChip extends StatelessWidget {
  final String value;
  final String label;
  final Color accent;
  const _StatChip(
      {required this.value, required this.label, required this.accent});

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Text(value,
              style: TextStyle(
                  color: accent,
                  fontSize: 22,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(color: Colors.white54, fontSize: 12)),
        ],
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUTTONS
// ─────────────────────────────────────────────────────────────────────────────
class _PrimaryButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _PrimaryButton(
      {required this.label,
      required this.icon,
      required this.color,
      required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: double.infinity,
          height: 56,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: .45),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(label,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w700)),
              const SizedBox(width: 10),
              const Icon(Icons.arrow_back_ios_new_rounded,
                  color: Colors.white, size: 15),
            ],
          ),
        ),
      );
}

class _OutlineButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  const _OutlineButton(
      {required this.label, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: double.infinity,
          height: 56,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white24, width: 1.5),
            color: Colors.white.withValues(alpha: .06),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white70, size: 20),
              const SizedBox(width: 10),
              Text(label,
                  style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 16,
                      fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM PAINTERS
// ─────────────────────────────────────────────────────────────────────────────
class _ArcPainter extends CustomPainter {
  final Color color;
  final int page;
  const _ArcPainter({required this.color, required this.page});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    // Three large arcs offset differently per page
    final offsets = [
      Offset(size.width * 1.1, -size.height * 0.15),
      Offset(-size.width * 0.1, size.height * 1.1),
      Offset(size.width * 0.5, -size.height * 0.3),
    ];

    for (int i = 0; i < 3; i++) {
      final r = size.width * (0.8 + i * 0.35);
      canvas.drawCircle(offsets[i % offsets.length], r, paint);
    }
  }

  @override
  bool shouldRepaint(_ArcPainter old) => old.page != page;
}

class _DotGridPainter extends CustomPainter {
  final Color color;
  const _DotGridPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    const spacing = 28.0;
    const dotR = 1.5;
    for (double x = spacing; x < size.width; x += spacing) {
      for (double y = spacing; y < size.height; y += spacing) {
        canvas.drawCircle(Offset(x, y), dotR, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotGridPainter old) => false;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────
class _SlideData {
  final List<Color> gradient;
  final Color accent;
  final IconData icon;
  final String badge;
  final String titleLine1;
  final String titleLine2;
  final String body;
  final String stat1;
  final String stat1Label;
  final String stat2;
  final String stat2Label;

  const _SlideData({
    required this.gradient,
    required this.accent,
    required this.icon,
    required this.badge,
    required this.titleLine1,
    required this.titleLine2,
    required this.body,
    required this.stat1,
    required this.stat1Label,
    required this.stat2,
    required this.stat2Label,
  });
}
