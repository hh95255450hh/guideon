import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'services/crash_reporter.dart';
import 'services/push_service.dart';
import 'theme/app_theme.dart';
import 'screens/web_app_screen.dart';

Future<void> main() async {
  // Catch every uncaught error and report it to the backend.
  runZonedGuarded(() async {
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

    // App version for crash context + the update gate.
    try {
      final info = await PackageInfo.fromPlatform();
      CrashReporter.init('${info.version}+${info.buildNumber}');
    } catch (_) {}

    // Framework errors → present + report.
    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      CrashReporter.report(details.exception, details.stack);
    };

    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    // Push notifications — no-op until Firebase config is added (defensive).
    await PushService.instance.init();

    runApp(const GuideonApp());
  }, (error, stack) => CrashReporter.report(error, stack));
}

class GuideonApp extends StatelessWidget {
  const GuideonApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Guideon',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      // Arabic-first; the app is bilingual.
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child!,
      ),
      // The whole platform lives at guideon.om — load it in a native shell.
      home: const WebAppScreen(),
    );
  }
}
