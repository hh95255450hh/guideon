import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../theme/app_theme.dart';
import 'home_shell.dart';
import 'login_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE DATA
// ─────────────────────────────────────────────────────────────────────────────
class _Slide {
  final String titleWhite;
  final String titleGold;
  final String body;
  final IconData icon;
  final String badge;
  final String stat1Val;
  final String stat1Lbl;
  final String stat2Val;
  final String stat2Lbl;
  const _Slide({
    required this.titleWhite,
    required this.titleGold,
    required this.body,
    required this.icon,
    required this.badge,
    required this.stat1Val,
    required this.stat1Lbl,
    required this.stat2Val,
    required this.stat2Lbl,
  });
}

const _slides = [
  _Slide(
    titleWhite: 'اكتشف عُمان',
    titleGold: 'الجميلة',
    body: 'تصفّح مئات المرشدين المحليين المعتمدين في كل ولاية، من مسقط إلى صلالة ومن نزوى إلى مسندم.',
    icon: Icons.travel_explore_rounded,
    badge: '🗺️',
    stat1Val: '١٠٠+', stat1Lbl: 'مرشد معتمد',
    stat2Val: '٢٥+',  stat2Lbl: 'وجهة سياحية',
  ),
  _Slide(
    titleWhite: 'احجز في',
    titleGold: 'دقيقتين',
    body: 'اختر مرشدك، حدد التاريخ والمجموعة، وأتمّ الدفع الآمن. كل شيء في مكان واحد بدون تعقيدات.',
    icon: Icons.event_available_rounded,
    badge: '✅',
    stat1Val: '٩٨٪',  stat1Lbl: 'رضا العملاء',
    stat2Val: '٢٤/٧', stat2Lbl: 'دعم فوري',
  ),
  _Slide(
    titleWhite: 'تجارب لا',
    titleGold: 'تُنسى',
    body: 'خبراء محليون يعرفون كل زاوية في السلطنة — استمتع برحلة أصيلة بعيداً عن السياحة التقليدية.',
    icon: Icons.landscape_rounded,
    badge: '⭐',
    stat1Val: '٤.٩', stat1Lbl: 'متوسط التقييم',
    stat2Val: '٥٠٠+', stat2Lbl: 'رحلة مكتملة',
  ),
];

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

  late final AnimationController _floatCtrl;
  late final AnimationController _fadeCtrl;
  late final AnimationController _pulseCtrl;
  late final Animation<double> _float;
  late final Animation<double> _fade;
  late final Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _floatCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 3000))
      ..repeat(reverse: true);
    _fadeCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 450));
    _pulseCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 2000))
      ..repeat(reverse: true);

    _float = Tween<double>(begin: -9, end: 9)
        .animate(CurvedAnimation(parent: _floatCtrl, curve: Curves.easeInOut));
    _fade = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _pulse = Tween<double>(begin: 0.85, end: 1.0)
        .animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));

    _fadeCtrl.forward();
  }

  @override
  void dispose() {
    _floatCtrl.dispose();
    _fadeCtrl.dispose();
    _pulseCtrl.dispose();
    _pageCtrl.dispose();
    super.dispose();
  }

  void _onPageChange(int i) {
    _fadeCtrl.forward(from: 0);
    setState(() => _page = i);
  }

  Future<void> _markDone() async {
    final p = await SharedPreferences.getInstance();
    await p.setBool('onboarding_done', true);
  }

  void _push(Widget dest) async {
    await _markDone();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(PageRouteBuilder(
      pageBuilder: (_, a, __) => dest,
      transitionsBuilder: (_, a, __, child) =>
          FadeTransition(opacity: a, child: child),
      transitionDuration: const Duration(milliseconds: 500),
    ));
  }

  void _next() => _pageCtrl.nextPage(
      duration: const Duration(milliseconds: 420), curve: Curves.easeInOut);

  // ── Build ────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final isLast = _page == _slides.length - 1;

    return Scaffold(
      body: Stack(
        children: [
          // ── Background — navy with teal gradient ──────────────
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [GdColors.navy, Color(0xFF0A2E2A)],
              ),
            ),
          ),

          // ── Decorative paint ───────────────────────────────────
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _page == 0
                  ? _float
                  : const AlwaysStoppedAnimation(0),
              builder: (_, __) => CustomPaint(
                painter: _BgPainter(page: _page, pulse: _pulse.value),
              ),
            ),
          ),

          // ── Logo watermark (bottom) ────────────────────────────
          const Positioned(
            bottom: -30,
            left: -30,
            child: Opacity(
              opacity: 0.03,
              child: Icon(Icons.travel_explore_rounded,
                  size: 220, color: Colors.white),
            ),
          ),

          // ── Main content ───────────────────────────────────────
          SafeArea(
            child: Column(
              children: [
                _buildTopBar(isLast),
                Expanded(
                  child: PageView.builder(
                    controller: _pageCtrl,
                    onPageChanged: _onPageChange,
                    itemCount: _slides.length,
                    itemBuilder: (_, i) => FadeTransition(
                      opacity: i == _page ? _fade : const AlwaysStoppedAnimation(1),
                      child: _SlideBody(
                        slide: _slides[i],
                        float: _float,
                        pulse: _pulse,
                      ),
                    ),
                  ),
                ),
                _buildBottom(isLast),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Top bar ────────────────────────────────────────────────────────────
  Widget _buildTopBar(bool isLast) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // ─ Guideon Logo ─
            Row(children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [GdColors.teal, Color(0xFF0A5C50)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: GdColors.teal.withValues(alpha: .5),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Icon(Icons.travel_explore_rounded,
                    color: Colors.white, size: 20),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Guideon',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -.4)),
                  Text('دليلك في عُمان',
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: .45),
                          fontSize: 10)),
                ],
              ),
            ]),

            // ─ Skip ─
            if (!isLast)
              GestureDetector(
                onTap: () => _push(const HomeShell()),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .08),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white.withValues(alpha: .15)),
                  ),
                  child: Text('تخطّى',
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: .6),
                          fontSize: 12,
                          fontWeight: FontWeight.w600)),
                ),
              )
            else
              const SizedBox(width: 60),
          ],
        ),
      );

  // ── Bottom area ────────────────────────────────────────────────────────
  Widget _buildBottom(bool isLast) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 36),
        child: Column(children: [
          // Dots
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
                  color: active ? GdColors.gold : Colors.white.withValues(alpha: .2),
                  borderRadius: BorderRadius.circular(4),
                ),
              );
            }),
          ),
          const SizedBox(height: 24),

          if (!isLast)
            // Next button
            _GdButton(
              label: 'التالي',
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: _next,
              filled: true,
            )
          else ...[
            // Tourist
            _GdButton(
              label: 'أبدأ كسائح',
              icon: Icons.luggage_rounded,
              onTap: () => _push(const HomeShell()),
              filled: true,
            ),
            const SizedBox(height: 10),
            // Guide
            _GdButton(
              label: 'أنا مرشد سياحي',
              icon: Icons.badge_rounded,
              onTap: () => _push(const LoginScreen()),
              filled: false,
            ),
          ],
        ]),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE BODY
// ─────────────────────────────────────────────────────────────────────────────
class _SlideBody extends StatelessWidget {
  final _Slide slide;
  final Animation<double> float;
  final Animation<double> pulse;
  const _SlideBody({required this.slide, required this.float, required this.pulse});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(children: [
        const SizedBox(height: 10),

        // ── Floating icon ──────────────────────────────────────
        Expanded(
          flex: 5,
          child: Center(
            child: AnimatedBuilder(
              animation: float,
              builder: (_, child) =>
                  Transform.translate(offset: Offset(0, float.value), child: child),
              child: AnimatedBuilder(
                animation: pulse,
                builder: (_, child) => Stack(
                  alignment: Alignment.center,
                  children: [
                    // Pulsing outer ring
                    Transform.scale(
                      scale: pulse.value,
                      child: Container(
                        width: 190,
                        height: 190,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: GdColors.teal.withValues(alpha: .12),
                            width: 1,
                          ),
                        ),
                      ),
                    ),
                    // Mid ring
                    Container(
                      width: 158,
                      height: 158,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: GdColors.teal.withValues(alpha: .2),
                          width: 1,
                        ),
                      ),
                    ),
                    // Glow
                    Container(
                      width: 140,
                      height: 140,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(colors: [
                          GdColors.teal.withValues(alpha: .25),
                          GdColors.teal.withValues(alpha: 0),
                        ]),
                      ),
                    ),
                    // Main circle
                    Container(
                      width: 118,
                      height: 118,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [GdColors.teal, Color(0xFF0A5C50)],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: GdColors.teal.withValues(alpha: .4),
                            blurRadius: 36,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: Icon(slide.icon, size: 56, color: Colors.white),
                    ),
                    // Badge
                    Positioned(
                      top: 18,
                      right: 14,
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: .2),
                              blurRadius: 8,
                            )
                          ],
                        ),
                        child: Center(
                          child: Text(slide.badge,
                              style: const TextStyle(fontSize: 16)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),

        // ── Text ──────────────────────────────────────────────
        Expanded(
          flex: 4,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
              const SizedBox(height: 4),
              RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      height: 1.2),
                  children: [
                    TextSpan(
                        text: slide.titleWhite,
                        style: const TextStyle(color: Colors.white)),
                    const TextSpan(text: '\n'),
                    TextSpan(
                        text: slide.titleGold,
                        style: const TextStyle(color: GdColors.gold)),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Text(
                slide.body,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: .58),
                  fontSize: 14,
                  height: 1.8,
                ),
              ),
              const SizedBox(height: 22),

              // Stats
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _Stat(value: slide.stat1Val, label: slide.stat1Lbl),
                  Container(
                      width: 1,
                      height: 30,
                      margin: const EdgeInsets.symmetric(horizontal: 22),
                      color: Colors.white.withValues(alpha: .1)),
                  _Stat(value: slide.stat2Val, label: slide.stat2Lbl),
                ],
              ),
            ],
          ),
        ),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT
// ─────────────────────────────────────────────────────────────────────────────
class _Stat extends StatelessWidget {
  final String value;
  final String label;
  const _Stat({required this.value, required this.label});

  @override
  Widget build(BuildContext context) => Column(children: [
        Text(value,
            style: const TextStyle(
                color: GdColors.gold, fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 2),
        Text(label,
            style: TextStyle(
                color: Colors.white.withValues(alpha: .45), fontSize: 11)),
      ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON
// ─────────────────────────────────────────────────────────────────────────────
class _GdButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool filled;
  const _GdButton(
      {required this.label,
      required this.icon,
      required this.onTap,
      required this.filled});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: double.infinity,
          height: 56,
          decoration: BoxDecoration(
            gradient: filled
                ? const LinearGradient(
                    colors: [GdColors.teal, Color(0xFF0A5C50)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
            color: filled ? null : Colors.transparent,
            borderRadius: BorderRadius.circular(16),
            border: filled
                ? null
                : Border.all(
                    color: Colors.white.withValues(alpha: .2), width: 1.5),
            boxShadow: filled
                ? [
                    BoxShadow(
                      color: GdColors.teal.withValues(alpha: .45),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    )
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: filled ? Colors.white : Colors.white60, size: 20),
              const SizedBox(width: 10),
              Text(label,
                  style: TextStyle(
                    color: filled ? Colors.white : Colors.white70,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  )),
            ],
          ),
        ),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND PAINTER
// ─────────────────────────────────────────────────────────────────────────────
class _BgPainter extends CustomPainter {
  final int page;
  final double pulse;
  const _BgPainter({required this.page, required this.pulse});

  @override
  void paint(Canvas canvas, Size size) {
    // Large teal arc top-right
    _arc(canvas,
        center: Offset(size.width * 1.15, -size.height * 0.08),
        radius: size.width * 0.95,
        color: const Color(0xFF0F7B6C),
        opacity: 0.07);

    // Smaller gold arc bottom-left
    _arc(canvas,
        center: Offset(-size.width * 0.1, size.height * 1.05),
        radius: size.width * 0.75,
        color: const Color(0xFFD4A017),
        opacity: 0.05);

    // Dot grid
    _grid(canvas, size, const Color(0xFF0F7B6C), 0.04);

    // Teal glow blob top-right corner
    final blobPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFF0F7B6C).withOpacity(0.18 * pulse),
          const Color(0xFF0F7B6C).withOpacity(0),
        ],
      ).createShader(Rect.fromCircle(
        center: Offset(size.width, 0),
        radius: size.width * 0.6,
      ));
    canvas.drawCircle(Offset(size.width, 0), size.width * 0.6, blobPaint);
  }

  void _arc(Canvas canvas,
      {required Offset center,
      required double radius,
      required Color color,
      required double opacity}) {
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = color.withOpacity(opacity)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );
  }

  void _grid(Canvas canvas, Size size, Color color, double opacity) {
    final p = Paint()..color = color.withOpacity(opacity);
    const sp = 32.0;
    for (double x = sp; x < size.width; x += sp) {
      for (double y = sp; y < size.height; y += sp) {
        canvas.drawCircle(Offset(x, y), 1.4, p);
      }
    }
  }

  @override
  bool shouldRepaint(_BgPainter old) =>
      old.page != page || old.pulse != pulse;
}
