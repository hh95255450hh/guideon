import 'package:geolocator/geolocator.dart';

/// Thin wrapper around `geolocator` that handles the permission dance and
/// never throws into the UI — callers get a position or `null`.
class LocationService {
  /// Result of a location attempt, so the UI can show the right message.
  static Future<LocationResult> current() async {
    // 1. Is the device's location service even on?
    if (!await Geolocator.isLocationServiceEnabled()) {
      return LocationResult.disabled;
    }

    // 2. Permission — request if not yet decided.
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied) {
      return LocationResult.denied;
    }
    if (perm == LocationPermission.deniedForever) {
      return LocationResult.deniedForever;
    }

    // 3. Fetch the fix.
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 12),
        ),
      );
      return LocationResult.ok(pos.latitude, pos.longitude);
    } catch (_) {
      return LocationResult.error;
    }
  }

  /// Straight-line distance in kilometres between two points.
  static double distanceKm(
      double lat1, double lon1, double lat2, double lon2) {
    return Geolocator.distanceBetween(lat1, lon1, lat2, lon2) / 1000.0;
  }
}

/// Outcome of a [LocationService.current] call.
class LocationResult {
  final double? lat;
  final double? lng;
  final LocationStatus status;

  const LocationResult._(this.status, [this.lat, this.lng]);

  factory LocationResult.ok(double lat, double lng) =>
      LocationResult._(LocationStatus.ok, lat, lng);

  static const disabled = LocationResult._(LocationStatus.serviceDisabled);
  static const denied = LocationResult._(LocationStatus.denied);
  static const deniedForever = LocationResult._(LocationStatus.deniedForever);
  static const error = LocationResult._(LocationStatus.error);

  bool get ok => status == LocationStatus.ok;

  /// Bilingual, user-friendly message for a non-ok result.
  String get message {
    switch (status) {
      case LocationStatus.serviceDisabled:
        return 'خدمة الموقع غير مفعّلة على جهازك.';
      case LocationStatus.denied:
        return 'تم رفض إذن الوصول للموقع.';
      case LocationStatus.deniedForever:
        return 'إذن الموقع مرفوض دائماً — فعّله من إعدادات التطبيق.';
      case LocationStatus.error:
        return 'تعذّر تحديد موقعك، حاول مجدداً.';
      case LocationStatus.ok:
        return '';
    }
  }
}

enum LocationStatus { ok, serviceDisabled, denied, deniedForever, error }
