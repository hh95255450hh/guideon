import 'package:flutter/foundation.dart'
    show TargetPlatform, defaultTargetPlatform;
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../services/api.dart';
import '../theme/app_theme.dart';

/// A full-screen, session-synced WebView used as a bottom-nav tab. The app now
/// mirrors the guideon.om platform: each tab loads the matching web page inside
/// this view, so the app always shows exactly what the website shows (same
/// buttons, same content) with zero duplicate native screens to keep in sync.
///
/// Kept alive inside the shell's IndexedStack so switching tabs doesn't reload.
class WebTab extends StatefulWidget {
  final String url;

  /// Hands the created controller up to the shell so the hardware back button
  /// can drive the active tab's web history.
  final void Function(WebViewController controller)? onReady;

  const WebTab({super.key, required this.url, this.onReady});

  @override
  State<WebTab> createState() => _WebTabState();
}

class _WebTabState extends State<WebTab> with AutomaticKeepAliveClientMixin {
  late final WebViewController _ctrl;
  double _progress = 0;
  bool _loading = true;
  bool _firstLoad = true; // show a full spinner only until the first paint

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _ctrl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white) // no black flash before first paint
      ..enableZoom(false) // app-like: no pinch-zoom on the page
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) => setState(() => _progress = p / 100),
        onPageStarted: (_) => setState(() => _loading = true),
        onPageFinished: (_) => setState(() {
          _loading = false;
          _firstLoad = false;
        }),
      ));

    // Android: let guideon.om pages use the camera (photo uploads) when asked.
    if (defaultTargetPlatform == TargetPlatform.android) {
      (_ctrl.platform as AndroidWebViewController)
          .setOnPlatformPermissionRequest((r) => r.grant());
    }

    widget.onReady?.call(_ctrl);
    _syncCookiesThenLoad();
  }

  // Copy the native session cookie into the WebView so a user who is logged in
  // natively opens the page authenticated (the WebView keeps its own jar).
  Future<void> _syncCookiesThenLoad() async {
    try {
      final cm = WebViewCookieManager();
      for (final c in await Api.instance.sessionCookies()) {
        await cm.setCookie(WebViewCookie(
          name: c.name,
          value: c.value,
          domain: 'guideon.om',
          path: (c.path == null || c.path!.isEmpty) ? '/' : c.path!,
        ));
      }
    } catch (_) {/* not logged in / no cookies — load anyway */}
    if (mounted) _ctrl.loadRequest(Uri.parse(widget.url));
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Column(
      children: [
        if (_loading)
          LinearProgressIndicator(
            value: _progress == 0 ? null : _progress,
            color: GdColors.teal,
            backgroundColor: const Color(0xFFE6F2EF),
            minHeight: 2.5,
          ),
        Expanded(
          child: Stack(
            children: [
              WebViewWidget(controller: _ctrl),
              // A clean branded spinner covers the blank page only on the very
              // first load, so the tab never shows an empty white void.
              if (_firstLoad)
                const ColoredBox(
                  color: Colors.white,
                  child: Center(
                    child: CircularProgressIndicator(color: GdColors.teal),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
