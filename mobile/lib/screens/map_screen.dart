import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../models/guide.dart';
import '../services/guide_service.dart';
import '../theme/app_theme.dart';
import 'guide_detail_screen.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen>
    with AutomaticKeepAliveClientMixin {
  final MapController _mapCtrl = MapController();

  List<Guide> _guides = [];
  bool _loading = true;
  String? _error;
  Guide? _selected;

  // Center that frames the whole Sultanate (Musandam → Dhofar), not just Muscat.
  static const _oman = LatLng(21.8, 56.8);

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      // Companies were previously never fetched here, so they never appeared
      // on the map even when they had resolvable coordinates.
      final results = await Future.wait([
        GuideService.search(limit: 100),
        GuideService.companies(limit: 100),
      ]);
      final guides = [...results[0], ...results[1]];
      if (mounted) {
        setState(() { _guides = guides; _loading = false; });
        // Frame the map around the guides that actually have coordinates.
        WidgetsBinding.instance.addPostFrameCallback((_) => _fitToMarkers());
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'تعذّر تحميل المرشدين'; _loading = false; });
    }
  }

  void _fitToMarkers() {
    final pts = _mapped.map((g) => LatLng(g.latitude!, g.longitude!)).toList();
    if (pts.isEmpty) return;
    if (pts.length == 1) {
      _mapCtrl.move(pts.first, 9);
      return;
    }
    try {
      _mapCtrl.fitCamera(CameraFit.coordinates(
        coordinates: pts,
        padding: const EdgeInsets.all(48),
        maxZoom: 9,
      ));
    } catch (_) {/* map not ready yet — default view is fine */}
  }

  // Guides that have coordinates
  List<Guide> get _mapped => _guides
      .where((g) => g.latitude != null && g.longitude != null)
      .toList();

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Scaffold(
      backgroundColor: GdColors.navy,
      body: Stack(
        children: [
          // ── Map ──────────────────────────────────────────────────────────
          FlutterMap(
            mapController: _mapCtrl,
            options: MapOptions(
              initialCenter: _oman,
              initialZoom: 6,
              onTap: (_, __) => setState(() => _selected = null),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'om.guideon.guideon',
                maxZoom: 18,
              ),
              MarkerLayer(markers: _buildMarkers()),
            ],
          ),

          // ── Loading ───────────────────────────────────────────────────────
          if (_loading)
            Container(
              color: GdColors.navy.withOpacity(0.85),
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: GdColors.teal, strokeWidth: 3),
                    SizedBox(height: 14),
                    Text('جاري تحميل الخارطة…',
                        style: TextStyle(color: Colors.white70, fontSize: 14)),
                  ],
                ),
              ),
            ),

          // ── Error ─────────────────────────────────────────────────────────
          if (_error != null && !_loading)
            Container(
              color: GdColors.navy,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.map_outlined, color: Colors.white24, size: 64),
                    const SizedBox(height: 16),
                    Text(_error!,
                        style: const TextStyle(color: Colors.white, fontSize: 17,
                            fontWeight: FontWeight.bold)),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: _load,
                      icon: const Icon(Icons.refresh),
                      label: const Text('إعادة المحاولة'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: GdColors.teal,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 28, vertical: 13),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // ── Guide count badge ─────────────────────────────────────────────
          if (!_loading && _error == null)
            Positioned(
              top: MediaQuery.of(context).padding.top + 12,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: GdColors.navy.withOpacity(0.85),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${_mapped.length} مرشد وشركة على الخارطة',
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ),
            ),

          // ── Selected guide card ───────────────────────────────────────────
          if (_selected != null)
            Positioned(
              bottom: 24,
              left: 16,
              right: 16,
              child: _GuideCard(
                guide: _selected!,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => GuideDetailScreen(guide: _selected!)),
                ),
                onClose: () => setState(() => _selected = null),
              ),
            ),
        ],
      ),
    );
  }

  List<Marker> _buildMarkers() {
    return _mapped.map((g) {
      final isSelected = _selected?.id == g.id;
      final isCompany = g.userType == 'company';
      return Marker(
        point: LatLng(g.latitude!, g.longitude!),
        width: isSelected ? 48 : 36,
        height: isSelected ? 48 : 36,
        child: GestureDetector(
          onTap: () => setState(() => _selected = g),
          child: Container(
            decoration: BoxDecoration(
              color: isSelected
                  ? GdColors.gold
                  : (isCompany ? GdColors.navy : GdColors.teal),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2),
              boxShadow: [
                BoxShadow(color: Colors.black26, blurRadius: 6, offset: const Offset(0, 3)),
              ],
            ),
            child: Icon(isCompany ? Icons.storefront : Icons.person_pin_circle,
                color: Colors.white, size: 20),
          ),
        ),
      );
    }).toList();
  }
}

class _GuideCard extends StatelessWidget {
  final Guide guide;
  final VoidCallback onTap;
  final VoidCallback onClose;

  const _GuideCard({
    required this.guide,
    required this.onTap,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(color: Colors.black26, blurRadius: 12, offset: const Offset(0, 4)),
          ],
        ),
        child: Row(
          children: [
            // Avatar
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: (guide.photo != null && guide.photo!.isNotEmpty)
                  ? CachedNetworkImage(
                      imageUrl: guide.photo!,
                      width: 56, height: 56, fit: BoxFit.cover,
                      memCacheWidth: 112,
                      errorWidget: (_, __, ___) => _avatar(guide.fullName))
                  : _avatar(guide.fullName),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(guide.fullName,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 15,
                          color: GdColors.navy)),
                  if (guide.destinations.isNotEmpty)
                    Text(guide.destinations.take(2).join(' · '),
                        style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                  const SizedBox(height: 4),
                  Row(children: [
                    const Icon(Icons.star, color: GdColors.gold, size: 14),
                    const SizedBox(width: 3),
                    Text(guide.rating.toStringAsFixed(1),
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ]),
                ],
              ),
            ),
            Column(
              children: [
                GestureDetector(
                  onTap: onClose,
                  child: const Icon(Icons.close, color: Colors.grey, size: 20),
                ),
                const SizedBox(height: 8),
                const Icon(Icons.arrow_forward_ios,
                    color: GdColors.teal, size: 16),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _avatar(String name) {
    final initials = name.trim().split(' ')
        .where((p) => p.isNotEmpty).take(2)
        .map((p) => p[0].toUpperCase()).join();
    return Container(
      width: 56, height: 56,
      color: GdColors.teal,
      child: Center(
        child: Text(initials,
            style: const TextStyle(color: Colors.white,
                fontWeight: FontWeight.bold, fontSize: 18)),
      ),
    );
  }
}
