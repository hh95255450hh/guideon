import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../theme/app_theme.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen>
    with AutomaticKeepAliveClientMixin {
  late final WebViewController _ctrl;
  bool _loading = true;

  // Keep the map alive when user switches to another tab
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _ctrl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0f1c3e))
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) {
          if (mounted) setState(() => _loading = false);
        },
      ))
      ..loadRequest(Uri.parse('https://guideon.om/explore.html'));

    // Enable geolocation on Android so the "Near Me" button works
    final platform = _ctrl.platform;
    if (platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(false);
      platform.setGeolocationEnabled(true);
    }
  }

  // Handle in-WebView back navigation (guide profile → back to map)
  Future<bool> _onWillPop() async {
    if (await _ctrl.canGoBack()) {
      await _ctrl.goBack();
      return false; // don't pop the route
    }
    return false; // stay on the map tab; don't exit the app
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        await _onWillPop();
      },
      child: Scaffold(
        backgroundColor: GdColors.navy,
        body: Stack(
          children: [
            WebViewWidget(controller: _ctrl),
            if (_loading)
              Container(
                color: GdColors.navy,
                child: const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(
                          color: GdColors.teal, strokeWidth: 3),
                      SizedBox(height: 16),
                      Text(
                        'جاري تحميل الخارطة…',
                        style: TextStyle(color: Colors.white70, fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
