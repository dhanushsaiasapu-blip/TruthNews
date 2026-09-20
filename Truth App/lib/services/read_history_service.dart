import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Tracks which story IDs the user has already opened, persisted locally
/// (SharedPreferences) so a read story stays hidden from the main feed
/// across app restarts. Exposes a [ValueListenable] so the feed screen can
/// react immediately when a story is marked read, without a manual refresh.
class ReadHistoryService {
  ReadHistoryService._();
  static final ReadHistoryService instance = ReadHistoryService._();

  static const String _storageKey = 'read_story_ids_v1';

  // Capped so this can never grow without bound on a device that's been
  // used for a long time. Oldest reads fall off first; a user is extremely
  // unlikely to notice a story reappear only after reading 1000+ others.
  static const int _maxTracked = 1000;

  /// Insertion-ordered so we can evict the oldest entries once [_maxTracked]
  /// is exceeded, while [readIds] gives O(1) membership checks everywhere
  /// else (the feed's per-story filter runs on every build).
  final List<String> _order = [];
  final ValueNotifier<Set<String>> readIds = ValueNotifier<Set<String>>({});

  bool _loaded = false;

  Future<void> _ensureLoaded() async {
    if (_loaded) return;
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = (jsonDecode(raw) as List<dynamic>)
            .map((e) => e.toString())
            .toList();
        _order
          ..clear()
          ..addAll(decoded);
        readIds.value = _order.toSet();
      } catch (_) {
        _order.clear();
        readIds.value = {};
      }
    }
    _loaded = true;
  }

  Future<void> init() => _ensureLoaded();

  /// Synchronous by design: the feed filters every story on every build,
  /// and it's fine (and expected) for this to report "unread" for the
  /// brief moment before init() resolves on cold start.
  bool isRead(String storyId) => readIds.value.contains(storyId);

  Future<void> markRead(String storyId) async {
    await _ensureLoaded();
    if (_order.contains(storyId)) return;
    _order.add(storyId);
    while (_order.length > _maxTracked) {
      _order.removeAt(0);
    }
    readIds.value = _order.toSet();
    await _persist();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, jsonEncode(_order));
  }

  /// Exposed for a future "reset read history" control in Profile/Settings.
  Future<void> clear() async {
    await _ensureLoaded();
    _order.clear();
    readIds.value = {};
    await _persist();
  }
}
