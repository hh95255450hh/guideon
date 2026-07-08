import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';

import 'screens/splash_screen.dart';
import 'services/api.dart';
import 'services/auth_service.dart';
import 'services/crash_reporter.dart';
import 'services/push_service.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    ErrorWidget.builder = (FlutterErrorDetails d) => Material(
          color: const Color(0xFFFFF1F0),
          child: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Text(
                '⚠️ ${d.exceptionAsString()}',
                textDirection: TextDirection.ltr,
                style: const TextStyle(color: Color(0xFFB00020), fontSize: 12),
              ),
            ),
          ),
        );

    try {
      final info = await PackageInfo.fromPlatform();
      CrashReporter.init('${info.version}+${info.buildNumber}');
    } catch (_) {}

    FlutterError.onError = (d) {
      FlutterError.presentError(d);
      CrashReporter.report(d.exception, d.stack);
    };

    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));

    await Api.instance.init();
    await PushService.instance.init();

    runApp(
      ChangeNotifierProvider(
        create: (_) => AuthService()..restore(),
        child: const GuideonApp(),
      ),
    );
  }, (e, s) => CrashReporter.report(e, s));
}

class GuideonApp extends StatelessWidget {
  const GuideonApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Guideon',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      // Dark theme is fully defined but not auto-activated yet: individual
      // screens still hardcode some light-only colors, so flip to
      // ThemeMode.system only after each screen is audited for dark contrast.
      themeMode: ThemeMode.light,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (ctx, child) =>
          Directionality(textDirection: TextDirection.rtl, child: child!),
      home: const SplashScreen(),
    );
  }
}
