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
    with AutomaticKeepAliveClientMixin, WidgetsBindingObserver {
  late final WebViewController _ctrl;
  bool _loading = true;
  bool _hasError = false;
  int _httpStatus = 200;

  static const _mapUrl = 'https://guideon.om/explore.html';

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initWebView();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Reload when the app returns to the foreground (e.g. after platform outage)
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _hasError) {
      _reload();
    }
  }

  void _initWebView() {
    _ctrl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0f1c3e))
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (_) {
          if (mounted) setState(() { _loading = true; _hasError = false; });
        },
        onPageFinished: (_) {
          if (mounted) setState(() => _loading = false);
        },
        onHttpError: (HttpResponseError error) {
          if (mounted) {
            setState(() {
              _httpStatus = error.response?.statusCode ?? 0;
              _hasError = true;
              _loading = false;
            });
          }
        },
        onWebResourceError: (WebResourceError error) {
          if (error.isForMainFrame == true && mounted) {
            setState(() { _hasError = true; _loading = false; });
          }
        },
      ))
      ..loadRequest(Uri.parse(_mapUrl));

    final platform = _ctrl.platform;
    if (platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(false);
      platform.setGeolocationEnabled(true);
    }
  }

  void _reload() {
    if (mounted) setState(() { _loading = true; _hasError = false; });
    _ctrl.loadRequest(Uri.parse(_mapUrl));
  }

  Future<bool> _onWillPop() async {
    if (await _ctrl.canGoBack()) {
      await _ctrl.goBack();
      return false;
    }
    return false;
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

            // ── Loading overlay ──
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

            // ── Error overlay with reload button ──
            if (_hasError && !_loading)
              Container(
                color: GdColors.navy,
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.map_outlined,
                          color: Colors.white24, size: 72),
                      const SizedBox(height: 20),
                      const Text(
                        'تعذّر تحميل الخارطة',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Map could not be loaded',
                        style: TextStyle(color: Colors.white54, fontSize: 13),
                      ),
                      const SizedBox(height: 28),
                      ElevatedButton.icon(
                        onPressed: _reload,
                        icon: const Icon(Icons.refresh),
                        label: const Text('إعادة المحاولة · Retry'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: GdColors.teal,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 28, vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
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
