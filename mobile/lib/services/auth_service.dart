import 'package:flutter/foundation.dart';
import '../models/user.dart';
import 'api.dart';

/// Holds the auth state for the whole app. Backed by the cookie-session in
/// [Api]; on launch we call /auth/me to restore a persisted session.
class AuthService extends ChangeNotifier {
  AppUser? _user;
  bool _loading = true;

  AppUser? get user => _user;
  bool get isLoggedIn => _user != null;
  bool get loading => _loading;

  /// Called once at startup to restore a saved session (if any).
  Future<void> restore() async {
    _loading = true;
    notifyListeners();
    try {
      final res = await Api.instance.get('/auth/me');
      if (res.statusCode == 200 && res.data['success'] != false) {
        _user = AppUser.fromJson(res.data as Map<String, dynamic>);
      }
    } catch (_) {
      // stay logged out
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Returns null on success, or a friendly error message on failure.
  Future<String?> login(String email, String password) async {
    try {
      final res = await Api.instance.post('/auth/login',
          data: {'email': email.trim(), 'password': password});
      if (res.statusCode == 200 && res.data['success'] != false) {
        await restore();
        return null;
      }
      return (res.data is Map && res.data['message'] is String)
          ? res.data['message']
          : 'بيانات الدخول غير صحيحة. / Invalid credentials.';
    } catch (e) {
      return friendlyError(e);
    }
  }

  Future<String?> register(Map<String, dynamic> body) async {
    try {
      final res = await Api.instance.post('/auth/register', data: body);
      if ((res.statusCode == 200 || res.statusCode == 201) &&
          res.data['success'] != false) {
        await restore();
        return null;
      }
      return (res.data is Map && res.data['message'] is String)
          ? res.data['message']
          : 'تعذّر إنشاء الحساب. / Could not create account.';
    } catch (e) {
      return friendlyError(e);
    }
  }

  Future<void> logout() async {
    try {
      await Api.instance.post('/auth/logout');
    } catch (_) {}
    await Api.instance.clearCookies();
    _user = null;
    notifyListeners();
  }

  /// Registers the device's FCM token with the backend (push notifications).
  Future<void> saveFcmToken(String token) async {
    try {
      await Api.instance.post('/auth/fcm-token', data: {'token': token});
    } catch (_) {}
  }
}
