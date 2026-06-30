import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../services/app_update.dart';
import '../theme/app_theme.dart';

/// The whole Guideon platform (guideon.om) inside a clean native shell —
/// full feature parity (search, booking, payment, messaging, dashboards, AI
/// planner) with a light, professional wrapper.
class WebAppScreen extends StatefulWidget {
  const WebAppScreen({super.key});

  @override
  State<WebAppScreen> createState() => _WebAppScreenState();
}

class _WebAppScreenState extends State<WebAppScreen> {
  static const String _home = 'https://guideon.om/explore.html';

  late final WebViewController _controller;
  double _progress = 0;
  bool _loading = true;
  bool _errored = false;
  AppUpdateInfo? _update;

  @override
  void initState() {
    super.initState();

    // Brand the status bar to blend with the site's teal header.
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: GdColors.teal,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
    ));

    _checkForUpdate();

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setUserAgent(null)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (p) {
            if (mounted) setState(() => _progress = p / 100);
          },
          onPageStarted: (_) {
            if (mounted) {
              setState(() {
                _loading = true;
                _errored = false;
              });
            }
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
            // Open links that would spawn a new window inside the app instead.
            _controller.runJavaScript(
              "document.querySelectorAll('a[target=\"_blank\"]')"
              ".forEach(function(a){a.target='_self';});",
            );
          },
          onWebResourceError: (err) {
            if (err.isForMainFrame == true && mounted) {
              setState(() {
                _errored = true;
                _loading = false;
              });
            }
          },
          onNavigationRequest: (req) {
            final url = req.url;
            final lower = url.toLowerCase();
            // Phone / email / SMS / WhatsApp → hand off to the right app.
            if (lower.startsWith('tel:') ||
                lower.startsWith('mailto:') ||
                lower.startsWith('sms:') ||
                lower.startsWith('whatsapp:') ||
                lower.contains('wa.me/') ||
                lower.contains('api.whatsapp.com')) {
              _openExternally(url);
              return NavigationDecision.prevent;
            }
            // All web pages (incl. payment gateways, Google OAuth) stay in-app.
            if (lower.startsWith('http://') || lower.startsWith('https://')) {
              return NavigationDecision.navigate;
            }
            // intent:, market:, geo:, etc. → external.
            _openExternally(url);
            return NavigationDecision.prevent;
          },
        ),
      )
      ..loadRequest(Uri.parse(_home));
  }

  Future<void> _openExternally(String url) async {
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {/* ignore unsupported schemes */}
  }

  Future<void> _reload() async {
    setState(() {
      _errored = false;
      _loading = true;
    });
    await _controller.loadRequest(Uri.parse(_home));
  }

  Future<void> _checkForUpdate() async {
    final u = await AppUpdate.check();
    if (u != null && u.mustUpdate && mounted) {
      setState(() => _update = u);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Force-update gate: blocks the app when this build is below the server's
    // required minimum (inactive until APP_MIN_BUILD is set).
    final update = _update;
    if (update != null && update.mustUpdate) {
      return _updateGate(update);
    }
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _controller.canGoBack()) {
          _controller.goBack();
        }
      },
      child: Scaffold(
        backgroundColor: GdColors.teal,
        body: SafeArea(
          bottom: false,
          child: Container(
            color: Colors.white,
            child: Column(
              children: [
                SizedBox(
                  height: 2.5,
                  child: _loading
                      ? LinearProgressIndicator(
                          value: _progress == 0 ? null : _progress,
                          color: GdColors.teal,
                          backgroundColor: const Color(0xFFE2F0EE),
                        )
                      : null,
                ),
                Expanded(
                  child: _errored
                      ? _errorView()
                      : WebViewWidget(controller: _controller),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _updateGate(AppUpdateInfo u) => Scaffold(
        backgroundColor: GdColors.navy,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.system_update,
                      size: 64, color: GdColors.gold),
                  const SizedBox(height: 18),
                  Text(
                    u.message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        height: 1.6),
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: () {
                      if (u.storeUrl.isNotEmpty) {
                        launchUrl(Uri.parse(u.storeUrl),
                            mode: LaunchMode.externalApplication);
                      }
                    },
                    icon: const Icon(Icons.shop),
                    label: const Text('تحديث الآن'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

  Widget _errorView() => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off, size: 56, color: GdColors.danger),
              const SizedBox(height: 14),
              const Text(
                'تعذّر الاتصال بالإنترنت.\nتأكّد من الشبكة وحاول مجدّداً.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: GdColors.navy,
                    fontSize: 16,
                    fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: _reload,
                icon: const Icon(Icons.refresh),
                label: const Text('إعادة المحاولة'),
              ),
            ],
          ),
        ),
      );
}
