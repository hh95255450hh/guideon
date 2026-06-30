import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../theme/app_theme.dart';

/// The whole Guideon platform (guideon.om) inside a clean native shell.
/// Gives full feature parity — search, booking, payment, messaging,
/// dashboards, AI planner — with a light app wrapper.
class WebAppScreen extends StatefulWidget {
  const WebAppScreen({super.key});

  @override
  State<WebAppScreen> createState() => _WebAppScreenState();
}

class _WebAppScreenState extends State<WebAppScreen> {
  static const String _home = 'https://guideon.om/';

  late final WebViewController _controller;
  double _progress = 0;
  bool _loading = true;
  bool _errored = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (p) {
            if (mounted) setState(() => _progress = p / 100);
          },
          onPageStarted: (_) {
            if (mounted) setState(() {
              _loading = true;
              _errored = false;
            });
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onWebResourceError: (err) {
            // Only treat the main document failing to load as an error screen.
            if (err.isForMainFrame == true && mounted) {
              setState(() {
                _errored = true;
                _loading = false;
              });
            }
          },
          onNavigationRequest: (req) {
            final url = req.url;
            // Keep all web pages (incl. payment gateways, Google OAuth) inside.
            if (url.startsWith('http://') || url.startsWith('https://')) {
              return NavigationDecision.navigate;
            }
            // tel:, mailto:, sms:, whatsapp:, intent: → hand to the OS.
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
    } catch (_) {/* ignore */}
  }

  Future<void> _reload() async {
    setState(() {
      _errored = false;
      _loading = true;
    });
    await _controller.loadRequest(Uri.parse(_home));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _controller.canGoBack()) {
          _controller.goBack();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(
            children: [
              if (_loading)
                LinearProgressIndicator(
                  value: _progress == 0 ? null : _progress,
                  minHeight: 2.5,
                  color: GdColors.teal,
                  backgroundColor: const Color(0xFFE2F0EE),
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
    );
  }

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
