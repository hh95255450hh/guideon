import 'dart:io' show Cookie;
import 'package:dio/dio.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:path_provider/path_provider.dart';

/// Single shared HTTP client for the whole app.
///
/// The Guideon backend authenticates with express-session **cookies**, not
/// bearer tokens. On mobile there's no browser cookie store, so we attach a
/// persistent [PersistCookieJar] — the session cookie survives app restarts,
/// which gives us "stay logged in" for free without rebuilding auth as JWT.
class Api {
  Api._();
  static final Api instance = Api._();

  static const String baseUrl = 'https://guideon.om/api';

  late final Dio dio;
  late final PersistCookieJar cookieJar;
  bool _ready = false;

  Future<void> init() async {
    if (_ready) return;
    final dir = await getApplicationSupportDirectory();
    cookieJar = PersistCookieJar(
      storage: FileStorage('${dir.path}/.cookies/'),
    );

    dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
      // Don't throw on 4xx — controllers return JSON {success:false,message}.
      validateStatus: (s) => s != null && s < 500,
      headers: {'Accept': 'application/json'},
    ));

    dio.interceptors.add(CookieManager(cookieJar));
    _ready = true;
  }

  /// Clears the session cookie (used on logout).
  Future<void> clearCookies() => cookieJar.deleteAll();

  /// The session cookies the app holds for guideon.om. Used to hand the
  /// express-session cookie to the in-app WebView (which has its OWN cookie
  /// store, separate from Dio's jar) so booking/payment pages open logged-in.
  Future<List<Cookie>> sessionCookies() =>
      cookieJar.loadForRequest(Uri.parse('https://guideon.om/'));

  // ── thin helpers ──────────────────────────────────────────────
  Future<Response> get(String path, {Map<String, dynamic>? query}) =>
      dio.get(path, queryParameters: query);

  Future<Response> post(String path, {dynamic data}) =>
      dio.post(path, data: data);

  Future<Response> put(String path, {dynamic data}) =>
      dio.put(path, data: data);

  Future<Response> patch(String path, {dynamic data}) =>
      dio.patch(path, data: data);

  Future<Response> delete(String path) => dio.delete(path);
}

/// Turns any backend / network failure into a friendly bilingual message,
/// matching the platform rule: never surface raw technical errors to users.
String friendlyError(Object e) {
  if (e is DioException) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError) {
      return 'تعذّر الاتصال بالخادم. تأكّد من الإنترنت وحاول مجدّداً.\n'
          'Could not reach the server. Check your connection.';
    }
    final data = e.response?.data;
    if (data is Map && data['message'] is String) return data['message'];
  }
  return 'حدث خطأ غير متوقّع. حاول لاحقاً.\nSomething went wrong. Please try again.';
}
