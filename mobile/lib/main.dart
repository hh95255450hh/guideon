import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'services/api.dart';
import 'services/auth_service.dart';
import 'services/push_service.dart';
import 'theme/app_theme.dart';
import 'screens/splash_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
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
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child!,
        ),
        home: const SplashScreen(),
      ),
    );
  }
}
