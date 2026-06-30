import 'dart:io' show Platform;

import 'package:dio/dio.dart';

/// Sends uncaught app errors to the backend (logged + Sentry server-side).
/// Fire-and-forget; never throws into the caller.
class CrashReporter {
  static final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 8),
    receiveTimeout: const Duration(seconds: 8),
  ));
  static String _version = '';

  static void init(String version) => _version = version;

  static Future<void> report(Object error, StackTrace? stack) async {
    try {
      await _dio.post(
        'https://guideon.om/api/app/error',
        data: {
          'message': error.toString(),
          'stack': stack?.toString() ?? '',
          'platform': Platform.operatingSystem,
          'appVersion': _version,
        },
      );
    } catch (_) {/* offline / server down — ignore */}
  }
}
