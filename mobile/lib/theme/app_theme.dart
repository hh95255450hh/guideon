import 'package:flutter/material.dart';

/// Guideon brand colors — mirror the web's CSS tokens (teal + navy + gold).
class GdColors {
  static const teal = Color(0xFF0F7B6C);
  static const tealDark = Color(0xFF0A5C50);
  static const tealLight = Color(0xFF14A08C);
  static const navy = Color(0xFF0F1C3E);
  static const gold = Color(0xFFD4A017);
  static const sand = Color(0xFFF4F7FA);
  static const muted = Color(0xFF6B7280);
  static const danger = Color(0xFFDC2626);
  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFF59E0B);

  // Dark-mode surfaces (deep navy family, not pure black — keeps the brand feel).
  static const darkBg = Color(0xFF0B1424);
  static const darkSurface = Color(0xFF141F38);
  static const darkCard = Color(0xFF1A2745);
  static const darkBorder = Color(0xFF26324F);
  static const darkMuted = Color(0xFF9AA6BE);
}

class AppTheme {
  // ── Shared building blocks so light & dark stay in lockstep ────────────────
  static TextTheme _text(Color body, Color heading) => TextTheme(
        headlineSmall: TextStyle(fontWeight: FontWeight.w800, color: heading),
        titleLarge: TextStyle(fontWeight: FontWeight.w800, color: heading),
        titleMedium: TextStyle(fontWeight: FontWeight.w700, color: heading),
        bodyLarge: TextStyle(color: body, height: 1.5),
        bodyMedium: TextStyle(color: body, height: 1.5),
        labelLarge: const TextStyle(fontWeight: FontWeight.w700),
      );

  static ElevatedButtonThemeData _elevatedBtn() => ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: GdColors.teal,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          elevation: 0,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
        ),
      );

  // ── Light ──────────────────────────────────────────────────────────────────
  static ThemeData light() {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      colorScheme: ColorScheme.fromSeed(
        seedColor: GdColors.teal,
        primary: GdColors.teal,
        secondary: GdColors.gold,
        surface: Colors.white,
      ),
      scaffoldBackgroundColor: const Color(0xFFF7FAFB),
      textTheme: _text(const Color(0xFF1F2733), GdColors.navy),
      appBarTheme: const AppBarTheme(
        backgroundColor: GdColors.teal,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
            fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white),
      ),
      elevatedButtonTheme: _elevatedBtn(),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: GdColors.teal,
          minimumSize: const Size.fromHeight(50),
          side: const BorderSide(color: GdColors.teal, width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: GdColors.teal),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: GdColors.sand,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: GdColors.teal, width: 1.6),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFFE7EAEE)),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: const Color(0xFFF0FAF8),
        side: const BorderSide(color: Color(0xFFD6EFE9)),
        labelStyle: const TextStyle(fontSize: 12.5, color: GdColors.tealDark),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      dividerTheme: const DividerThemeData(
          color: Color(0xFFEAEEF2), thickness: 1, space: 1),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: GdColors.navy,
        contentTextStyle: const TextStyle(color: Colors.white),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  // ── Dark ─────────────────────────────────────────────────────────────────
  static ThemeData dark() {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      colorScheme: ColorScheme.fromSeed(
        seedColor: GdColors.teal,
        brightness: Brightness.dark,
        primary: GdColors.tealLight,
        secondary: GdColors.gold,
        surface: GdColors.darkSurface,
      ),
      scaffoldBackgroundColor: GdColors.darkBg,
      textTheme: _text(const Color(0xFFE6EBF5), Colors.white),
      appBarTheme: const AppBarTheme(
        backgroundColor: GdColors.darkSurface,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
            fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white),
      ),
      elevatedButtonTheme: _elevatedBtn(),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: GdColors.tealLight,
          minimumSize: const Size.fromHeight(50),
          side: const BorderSide(color: GdColors.tealLight, width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: GdColors.tealLight),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: GdColors.darkCard,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: GdColors.tealLight, width: 1.6),
        ),
        hintStyle: const TextStyle(color: GdColors.darkMuted),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: GdColors.darkCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: GdColors.darkBorder),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: GdColors.darkCard,
        side: const BorderSide(color: GdColors.darkBorder),
        labelStyle: const TextStyle(fontSize: 12.5, color: Color(0xFFCFE9E3)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      dividerTheme: const DividerThemeData(
          color: GdColors.darkBorder, thickness: 1, space: 1),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: GdColors.darkCard,
        contentTextStyle: const TextStyle(color: Colors.white),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
