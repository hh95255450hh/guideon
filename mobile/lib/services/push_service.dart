import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'api.dart';

/// Background message handler — must be a top-level function.
@pragma('vm:entry-point')
Future<void> _bgHandler(RemoteMessage message) async {
  // No-op for now; the OS shows the notification. Hook deep links here later.
}

/// Push notifications via Firebase Cloud Messaging.
///
/// Fully defensive: if Firebase isn't configured yet (no google-services.json /
/// GoogleService-Info.plist), [init] quietly no-ops so the app still runs. Once
/// the config files are added, push activates with no further code changes.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  bool _ready = false;

  Future<void> init() async {
    if (_ready) return;
    try {
      await Firebase.initializeApp();
    } catch (e) {
      // Firebase not configured (or unavailable) — skip push gracefully.
      if (kDebugMode) debugPrint('Push disabled (Firebase not configured): $e');
      return;
    }
    _ready = true;

    final messaging = FirebaseMessaging.instance;
    FirebaseMessaging.onBackgroundMessage(_bgHandler);

    // iOS/Android 13+ runtime permission.
    await messaging.requestPermission(alert: true, badge: true, sound: true);

    // Refresh the server token whenever it rotates.
    messaging.onTokenRefresh.listen(_registerToken);
  }

  /// Call after a successful login (and on app start when already logged in).
  Future<void> syncToken() async {
    if (!_ready) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _registerToken(token);
    } catch (_) {/* ignore — non-critical */}
  }

  Future<void> _registerToken(String token) async {
    try {
      await Api.instance.post('/auth/fcm-token', data: {'token': token});
    } catch (_) {/* user may be logged out; ignore */}
  }
}
