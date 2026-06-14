import 'package:flutter/material.dart';

/// Guideon brand colors — mirror the web's CSS tokens (teal + navy + gold).
class GdColors {
  static const teal = Color(0xFF0F7B6C);
  static const tealDark = Color(0xFF0A5C50);
  static const navy = Color(0xFF0F1C3E);
  static const gold = Color(0xFFD4A017);
  static const sand = Color(0xFFF4F7FA);
  static const muted = Color(0xFF6B7280);
  static const danger = Color(0xFFDC2626);
  static const success = Color(0xFF16A34A);
}

class AppTheme {
  static ThemeData light() {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      colorScheme: ColorScheme.fromSeed(
        seedColor: GdColors.teal,
        primary: GdColors.teal,
        secondary: GdColors.gold,
      ),
      scaffoldBackgroundColor: Colors.white,
      appBarTheme: const AppBarTheme(
        backgroundColor: GdColors.teal,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: GdColors.teal,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: GdColors.sand,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Color(0xFFE7EAEE)),
        ),
      ),
    );
  }
}
