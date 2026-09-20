import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Production news client. No provider credentials are shipped in the app.
/// Configure the HTTPS backend with --dart-define=BACKEND_BASE_URL=....
class NewsServiceException implements Exception {
  final String message;
  const NewsServiceException(this.message);

  @override
  String toString() => message;
}

class LiveNewsService {
  LiveNewsService._();

  // The production backend is the default so release APKs work even when
  // the app is launched without a --dart-define. A dart-define can still
  // override this for local/staging development.
  static const String _defaultBaseUrl =
      'https://truth-news-api.onrender.com';

  static const String _configuredBaseUrl = String.fromEnvironment(
    'BACKEND_BASE_URL',
    defaultValue: _defaultBaseUrl,
  );

  static String get baseUrl {
    final configured = _configuredBaseUrl.trim();
    final value = configured.isEmpty ? _defaultBaseUrl : configured;
    return value.replaceFirst(RegExp(r'/+$'), '');
  }

  static bool get isConfigured {
    final uri = Uri.tryParse(baseUrl);
    return uri != null && uri.scheme == 'https' && uri.host.isNotEmpty;
  }

  static final Dio _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
      // Render can take a while to wake a sleeping service. Keep the HTTP
      // request alive long enough for the physical phone to receive it.
      receiveTimeout: const Duration(seconds: 90),
      headers: const {'Accept': 'application/json'},
      responseType: ResponseType.json,
    ),
  );

  static const String _cacheKeyPrefix = 'truth_news_response_v2_';
  static const Duration _clientCacheMaxAge = Duration(hours: 6);

  static String _cacheKey(List<String> categories) {
    final normalized = [...categories]
      ..sort()
      ..removeWhere((value) => value.trim().isEmpty);
    return '$_cacheKeyPrefix${normalized.join('|')}';
  }

  /// Returns the last successful server response immediately on app restart.
  /// The UI can render this while a fresh network request happens in parallel.
  static Future<List<Map<String, dynamic>>> loadCachedStories(
    List<String> categories,
  ) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final encoded = prefs.getString(_cacheKey(categories));
      if (encoded == null || encoded.isEmpty) return [];
      final envelope = jsonDecode(encoded);
      if (envelope is! Map) return [];
      final savedAt = DateTime.tryParse('${envelope['savedAt'] ?? ''}');
      if (savedAt == null || DateTime.now().difference(savedAt) > _clientCacheMaxAge) {
        return [];
      }
      final articles = envelope['articles'];
      if (articles is! List) return [];
      return articles
          .whereType<Map>()
          .map((article) => Map<String, dynamic>.from(article))
          .map(_normaliseStory)
          .whereType<Map<String, dynamic>>()
          .toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> _saveCachedStories(
    List<String> categories,
    List<Map<String, dynamic>> articles,
  ) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _cacheKey(categories),
        jsonEncode({
          'savedAt': DateTime.now().toIso8601String(),
          'articles': articles,
        }),
      );
    } catch (_) {
      // Local caching is an optimization; never fail a live news request.
    }
  }

  /// Expected backend response: {"articles": [...]}.
  /// Invalid records are discarded so malformed upstream data cannot crash
  /// the UI. The backend owns provider/API credentials and any AI processing.
  static Future<List<Map<String, dynamic>>> fetchLiveStories(
    List<String> categories, {
    bool forceRefresh = false,
  }) async {
    if (!isConfigured) return [];

    DioException? lastNetworkError;

    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        final response = await _dio.get<dynamic>(
          '$baseUrl/news',
          queryParameters: {
            if (categories.isNotEmpty && !categories.contains('All'))
              'categories': categories.join(','),
            if (forceRefresh) 'refresh': '1',
          },
        );
        if (response.statusCode == null ||
            response.statusCode! < 200 ||
            response.statusCode! >= 300) {
          throw NewsServiceException(
            'News server returned HTTP ${response.statusCode ?? 'unknown'}.',
          );
        }
        final data = response.data;
        final rawArticles = data is Map ? data['articles'] : data;
        if (rawArticles is! List) {
          throw const NewsServiceException(
            'News service returned an invalid response.',
          );
        }
        final stories = rawArticles
            .whereType<Map>()
            .map((article) => Map<String, dynamic>.from(article))
            .map(_normaliseStory)
            .whereType<Map<String, dynamic>>()
            .toList();
        unawaited(_saveCachedStories(categories, stories));
        return stories;
      } on DioException catch (error) {
        lastNetworkError = error;
        final statusCode = error.response?.statusCode;
        final retryableStatus =
            statusCode == 429 ||
            statusCode == 500 ||
            statusCode == 502 ||
            statusCode == 503 ||
            statusCode == 504;
        final retryable =
            error.type == DioExceptionType.connectionError ||
            error.type == DioExceptionType.connectionTimeout ||
            error.type == DioExceptionType.receiveTimeout ||
            error.type == DioExceptionType.sendTimeout ||
            retryableStatus;
        if (!retryable || attempt == 2) break;
        await Future<void>.delayed(const Duration(seconds: 2));
      } on NewsServiceException {
        rethrow;
      } catch (_) {
        throw const NewsServiceException(
          'News is temporarily unavailable. Please try again later.',
        );
      }
    }

    if (lastNetworkError != null) {
      final statusCode = lastNetworkError.response?.statusCode;
      if (statusCode != null) {
        throw NewsServiceException(
          'News server returned HTTP $statusCode. Please try again.',
        );
      }
      throw const NewsServiceException(
        'The news server took too long to respond. Please try again.',
      );
    }

    throw const NewsServiceException(
      'News is temporarily unavailable. Please try again later.',
    );
  }

  static Map<String, dynamic>? _normaliseStory(Map<String, dynamic> raw) {
    final id = _nonEmptyString(raw['id']);
    final headline = _nonEmptyString(raw['headline'] ?? raw['title']);
    final category = _nonEmptyString(raw['category']) ?? 'World';
    final articleUrl = _validHttpUrl(raw['articleUrl'] ?? raw['url']);
    if (id == null || headline == null || articleUrl == null) return null;

    final summary =
        _nonEmptyString(
          raw['neutralSummary'] ?? raw['summary'] ?? raw['description'],
        ) ??
        headline;
    final imageUrl = _validHttpUrl(raw['imageUrl'] ?? raw['urlToImage']);
    final publishedAt = _nonEmptyString(raw['publishedAt']);
    final sourceValue = raw['source'];
    final sourceName =
        _nonEmptyString(raw['sourceName']) ??
        (sourceValue is Map ? _nonEmptyString(sourceValue['name']) : null);

    final outlets = _parseOutlets(raw['outlets']);
    if (outlets.isEmpty) {
      outlets.add({
        'name': sourceName ?? 'Original source',
        'lean': 'Center',
        'framing': '',
        'articleUrl': articleUrl,
        'imageUrl': imageUrl ?? '',
        'publishedAt': publishedAt ?? '',
        'publishedAgo':
            publishedAt == null ? '' : _publishedLabel(publishedAt, null),
      });
    }

    return {
      'id': id,
      'headline': headline,
      'neutralSummary': summary,
      'summarySource': _summarySource(raw['summarySource']),
      'category': category,
      'categories': raw['categories'] is List
          ? (raw['categories'] as List).whereType<String>().toList()
          : [category],
      'country': _nonEmptyString(raw['country']) ?? '',
      'region': _nonEmptyString(raw['region']) ?? '',
      'sourceType': _nonEmptyString(raw['sourceType']) ?? 'publisher',
      'politicalLean': _normaliseLean(raw['politicalLean']),
      'politicalLeanConfidence': _nonEmptyString(raw['politicalLeanConfidence']) ?? 'low',
      'articlePoliticalEstimate': _nonEmptyString(raw['articlePoliticalEstimate']) ?? 'Unknown',
      'articlePoliticalEstimateConfidence': _nonEmptyString(raw['articlePoliticalEstimateConfidence']) ?? 'low',
      'storyClusterId': _nonEmptyString(raw['storyClusterId']) ?? id,
      'outletCount': outlets.length,
      'publishedAgo': _publishedLabel(publishedAt, raw['publishedAgo']),
      'publishedAt': publishedAt,
      'sourceName': sourceName ?? 'Source unavailable',
      'articleUrl': articleUrl,
      'imageUrl': imageUrl ?? '',
      'semanticLabel': _nonEmptyString(raw['semanticLabel']) ?? headline,
      'outlets': outlets,
      'isBreaking': raw['isBreaking'] is bool ? raw['isBreaking'] : false,
    };
  }

  static List<Map<String, String>> _parseOutlets(dynamic value) {
    if (value is! List) return [];
    final outlets = <Map<String, String>>[];
    for (final item in value) {
      if (item is! Map) continue;
      final name = _nonEmptyString(item['name']);
      final url = _validHttpUrl(item['articleUrl'] ?? item['url']);
      if (name == null || url == null) continue;
      final outletImageUrl = _validHttpUrl(item['imageUrl']) ?? '';
      final outletPublishedAt = _nonEmptyString(item['publishedAt']) ?? '';
      outlets.add({
        'name': name,
        // The backend always assigns a real lean (with a static fallback
        // table when the AI classifier is unavailable), so this default
        // should only ever be hit for malformed/legacy payloads. 'Center'
        // is a safe, renderable default -- 'Unknown' matched no color or
        // label case in AppTheme and effectively broke the outlet's UI.
        'lean': _normaliseLean(item['lean']),
        'framing': _nonEmptyString(item['framing']) ?? '',
        'articleUrl': url,
        'imageUrl': outletImageUrl,
        'publishedAt': outletPublishedAt,
        'publishedAgo':
            outletPublishedAt.isEmpty ? '' : _publishedLabel(outletPublishedAt, null),
      });
    }
    return outlets;
  }

  static String _summarySource(dynamic value) {
    return value == 'ai' ? 'ai' : 'source';
  }

  static const Set<String> _allowedLeans = {
    'Left',
    'Lean Left',
    'Center',
    'Lean Right',
    'Right',
  };

  static String _normaliseLean(dynamic value) {
    final lean = _nonEmptyString(value);
    return lean != null && _allowedLeans.contains(lean) ? lean : 'Center';
  }

  static String? _nonEmptyString(dynamic value) {
    if (value is! String) return null;
    final result = value.trim();
    return result.isEmpty ? null : result;
  }

  static String? _validHttpUrl(dynamic value) {
    final string = _nonEmptyString(value);
    if (string == null) return null;
    final uri = Uri.tryParse(string);
    if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) {
      return null;
    }
    return string;
  }

  // This label is kept in the data model for potential future use (e.g. a
  // "sort by freshness" control) but is not rendered anywhere in the current
  // UI -- publication-time text was intentionally removed from the visible
  // app. No user-facing placeholder is used when a timestamp is missing.
  static String _publishedLabel(dynamic publishedAt, dynamic fallback) {
    final fallbackLabel = _nonEmptyString(fallback);
    final timestamp = _nonEmptyString(publishedAt);
    if (timestamp == null) {
      return fallbackLabel ?? '';
    }
    final parsed = DateTime.tryParse(timestamp)?.toLocal();
    if (parsed == null) return fallbackLabel ?? '';
    final delta = DateTime.now().difference(parsed);
    if (delta.isNegative || delta.inMinutes < 1) return 'Just now';
    if (delta.inMinutes < 60) return '${delta.inMinutes}m ago';
    if (delta.inHours < 24) return '${delta.inHours}h ago';
    if (delta.inDays < 7) return '${delta.inDays}d ago';
    return '${parsed.day}/${parsed.month}/${parsed.year}';
  }
}
