import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../services/api.dart';
import '../theme/app_theme.dart';

/// Opens a guideon.om page inside the app (in-app WebView) with the native
/// session cookie synced over first, so the user stays logged in.
///
/// Use this instead of `launchUrl(..., mode: LaunchMode.externalApplication)`
/// for ANY guideon.om page — the external browser has its own cookie jar with
/// no session, so a logged-in user lands there looking logged OUT. External
/// launch should only be used for things that must leave the app entirely
/// (e.g. the Play/App Store listing).
/// Returns the Navigator push Future, which completes when the sheet is
/// popped — useful for e.g. re-checking auth state after a register/login
/// page closes (the WebView has its own cookie store, so a session created
/// inside it isn't automatically known to the native app until then).
Future<void> openInAppWeb(BuildContext context, String page, String title) {
  final url = page.startsWith('http') ? page : 'https://guideon.om/$page';
  return Navigator.of(context).push(MaterialPageRoute(
    builder: (_) => WebSheet(url: url, title: title),
  ));
}

/// In-app WebView sheet — session cookies are synced from the native app
/// before the page loads, so booking/dashboard/profile pages open
/// authenticated instead of dropping the user into a logged-out browser tab.
class WebSheet extends StatefulWidget {
  final String url;
  final String title;
  const WebSheet({super.key, required this.url, required this.title});
  @override
  State<WebSheet> createState() => _WebSheetState();
}

class _WebSheetState extends State<WebSheet> {
  late final WebViewController _ctrl;
  double _progress = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _ctrl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) => setState(() => _progress = p / 100),
        onPageStarted: (_) => setState(() { _loading = true; }),
        onPageFinished: (_) => setState(() { _loading = false; }),
      ));
    _syncCookiesThenLoad();
  }

  // The WebView keeps its own cookie store, separate from the app's Dio jar,
  // so a natively-logged-in user would appear logged OUT inside this page.
  // Copy the express-session cookie over before loading so it opens authenticated.
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
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title, style: const TextStyle(fontSize: 15)),
        backgroundColor: GdColors.teal,
        foregroundColor: Colors.white,
        bottom: _loading
            ? PreferredSize(
                preferredSize: const Size.fromHeight(3),
                child: LinearProgressIndicator(
                  value: _progress == 0 ? null : _progress,
                  color: GdColors.gold,
                  backgroundColor: Colors.white30,
                ),
              )
            : null,
      ),
      body: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) async {
          if (didPop) return;
          if (await _ctrl.canGoBack()) {
            _ctrl.goBack();
          } else {
            if (context.mounted) Navigator.of(context).pop();
          }
        },
        child: WebViewWidget(controller: _ctrl),
      ),
    );
  }
}
