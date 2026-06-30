import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'services/api.dart';
import 'services/auth_service.dart';
import 'services/push_service.dart';
import 'theme/app_theme.dart';
import 'screens/splash_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Make release-mode widget errors VISIBLE (default shows a blank gray box).
  ErrorWidget.builder = (FlutterErrorDetails details) => Material(
        color: const Color(0xFFFFF1F0),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Text(
              '⚠️ خطأ في الواجهة:\n\n${details.exceptionAsString()}',
              textDirection: TextDirection.ltr,
              style: const TextStyle(color: Color(0xFFB00020), fontSize: 13),
            ),
          ),
        ),
      );

  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  await Api.instance.init();
  // Non-blocking: activates only once Firebase config is added.
  await PushService.instance.init();

  runApp(const GuideonApp());
}

class GuideonApp extends StatelessWidget {
  const GuideonApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthService()..restore(),
      child: MaterialApp(
        title: 'Guideon',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        // Arabic-first; the app is bilingual.
        locale: const Locale('ar'),
        supportedLocales: const [Locale('ar'), Locale('en')],
        // REQUIRED for a non-English locale — without these, Material widgets
        // (TextField, etc.) throw "No MaterialLocalizations found" → blank gray.
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child!,
        ),
        home: const SplashScreen(),
      ),
    );
  }
}
