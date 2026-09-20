import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../routes/app_routes.dart';
import '../../services/live_news_service.dart';
import '../../services/read_history_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_image_widget.dart';
import '../../widgets/empty_state_widget.dart';

class StoryModel {
  final String id;
  final String headline;
  final String neutralSummary;
  final String summarySource;
  final String category;
  final List<String> categories;
  final String country;
  final String region;
  final String sourceType;
  final String politicalLean;
  final String politicalLeanConfidence;
  final String articlePoliticalEstimate;
  final String articlePoliticalEstimateConfidence;
  final String storyClusterId;
  final int outletCount;
  final String publishedAgo;
  final String publishedAt;
  final String sourceName;
  final String articleUrl;
  final String imageUrl;
  final String semanticLabel;
  final List<Map<String, String>> outlets;
  final bool isBreaking;

  const StoryModel({
    required this.id,
    required this.headline,
    required this.neutralSummary,
    required this.summarySource,
    required this.category,
    required this.categories,
    required this.country,
    required this.region,
    required this.sourceType,
    required this.politicalLean,
    required this.politicalLeanConfidence,
    required this.articlePoliticalEstimate,
    required this.articlePoliticalEstimateConfidence,
    required this.storyClusterId,
    required this.outletCount,
    required this.publishedAgo,
    required this.publishedAt,
    required this.sourceName,
    required this.articleUrl,
    required this.imageUrl,
    required this.semanticLabel,
    required this.outlets,
    required this.isBreaking,
  });

  factory StoryModel.fromMap(Map<String, dynamic> map) {
    final id = _requiredString(map, 'id');
    final headline = _requiredString(map, 'headline');
    final articleUrl = _requiredUrl(map, 'articleUrl');
    final category = _optionalString(map['category']) ?? 'World';
    final categories = (map['categories'] is List)
        ? (map['categories'] as List).whereType<String>().map((e) => e.trim()).where((e) => e.isNotEmpty).toList()
        : <String>[category];
    final summary = _optionalString(map['neutralSummary']) ?? headline;
    final summarySource = map['summarySource'] == 'ai' ? 'ai' : 'source';
    final sourceName = _optionalString(map['sourceName']) ?? 'Source unavailable';
    final imageUrl = _optionalString(map['imageUrl']) ?? '';
    final semanticLabel = _optionalString(map['semanticLabel']) ?? headline;
    final publishedAt = _optionalString(map['publishedAt']) ?? '';
    // Publication-time text is not shown anywhere in the UI (by design --
    // see live_news_service/server for why timestamps are still kept
    // internally for sorting/clustering). Keep whatever the backend sent,
    // with no user-facing placeholder string.
    final publishedAgo = _optionalString(map['publishedAgo']) ?? '';
    final outlets = _parseOutlets(map['outlets']);

    return StoryModel(
      id: id,
      headline: headline,
      neutralSummary: summary,
      summarySource: summarySource,
      category: category,
      categories: categories,
      country: _optionalString(map['country']) ?? '',
      region: _optionalString(map['region']) ?? '',
      sourceType: _optionalString(map['sourceType']) ?? 'publisher',
      politicalLean: _normaliseLean(map['politicalLean']),
      politicalLeanConfidence: _optionalString(map['politicalLeanConfidence']) ?? 'low',
      articlePoliticalEstimate: _optionalString(map['articlePoliticalEstimate']) ?? 'Unknown',
      articlePoliticalEstimateConfidence: _optionalString(map['articlePoliticalEstimateConfidence']) ?? 'low',
      storyClusterId: _optionalString(map['storyClusterId']) ?? id,
      outletCount: outlets.isEmpty
          ? _safeInt(map['outletCount'], 1)
          : outlets.length,
      publishedAgo: publishedAgo,
      publishedAt: publishedAt,
      sourceName: sourceName,
      articleUrl: articleUrl,
      imageUrl: imageUrl,
      semanticLabel: semanticLabel,
      outlets: outlets,
      isBreaking: map['isBreaking'] is bool ? map['isBreaking'] as bool : false,
    );
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'headline': headline,
        'neutralSummary': neutralSummary,
        'summarySource': summarySource,
        'category': category,
        'categories': categories,
        'country': country,
        'region': region,
        'sourceType': sourceType,
        'politicalLean': politicalLean,
        'politicalLeanConfidence': politicalLeanConfidence,
        'articlePoliticalEstimate': articlePoliticalEstimate,
        'articlePoliticalEstimateConfidence': articlePoliticalEstimateConfidence,
        'storyClusterId': storyClusterId,
        'outletCount': outletCount,
        'publishedAgo': publishedAgo,
        'publishedAt': publishedAt,
        'sourceName': sourceName,
        'articleUrl': articleUrl,
        'imageUrl': imageUrl,
        'semanticLabel': semanticLabel,
        'outlets': outlets,
        'isBreaking': isBreaking,
      };

  static String _requiredString(Map<String, dynamic> map, String key) {
    final value = _optionalString(map[key]);
    if (value == null) throw FormatException('Story is missing $key');
    return value;
  }

  static String _requiredUrl(Map<String, dynamic> map, String key) {
    final value = _requiredString(map, key);
    final uri = Uri.tryParse(value);
    if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) {
      throw FormatException('Story contains an invalid $key');
    }
    return value;
  }

  static String _normaliseLean(dynamic value) {
    const allowed = {'Left', 'Lean Left', 'Center', 'Lean Right', 'Right'};
    final lean = _optionalString(value);
    return lean != null && allowed.contains(lean) ? lean : 'Center';
  }

  static String? _optionalString(dynamic value) {
    if (value is! String) return null;
    final result = value.trim();
    return result.isEmpty ? null : result;
  }

  static int _safeInt(dynamic value, int fallback) {
    if (value is int && value >= 0) return value;
    if (value is num && value.isFinite && value >= 0) return value.toInt();
    return fallback;
  }

  static List<Map<String, String>> _parseOutlets(dynamic value) {
    if (value is! List) return [];
    return value.whereType<Map>().map((item) {
      final name = _optionalString(item['name']);
      final url = _optionalString(item['articleUrl'] ?? item['url']);
      if (name == null || url == null) return null;
      final uri = Uri.tryParse(url);
      if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) {
        return null;
      }
      final outletImageUrl = _optionalString(item['imageUrl']) ?? '';
      final outletPublishedAt = _optionalString(item['publishedAt']) ?? '';
      return <String, String>{
        'name': name,
        // 'Center' is a safe, renderable default; the backend always
        // assigns a real lean, so this only matters for malformed data.
        'lean': _optionalString(item['lean']) ?? 'Center',
        'framing': _optionalString(item['framing']) ?? '',
        'articleUrl': url,
        'imageUrl': outletImageUrl,
        'publishedAt': outletPublishedAt,
        'publishedAgo': _optionalString(item['publishedAgo']) ?? '',
      };
    }).whereType<Map<String, String>>().toList();
  }
}

class NewsFeedScreen extends StatefulWidget {
  const NewsFeedScreen({super.key});

  @override
  State<NewsFeedScreen> createState() => _NewsFeedScreenState();
}

class _NewsFeedScreenState extends State<NewsFeedScreen> {
  static const _categories = [
    'All',
    'World',
    'Politics',
    'Business',
    'Technology',
    'Science',
    'Health',
  ];

  final _pageController = PageController();
  final _searchController = TextEditingController();
  List<StoryModel> _stories = [];
  String _selectedCategory = 'All';
  String _searchQuery = '';
  bool _loading = true;
  bool _refreshing = false;
  bool _searching = false;
  bool _loadingMore = false;
  String? _errorMessage;

  // Stories in the selected category, regardless of read state. Search
  // deliberately searches this list (not the unread-only one) so the user
  // can still find and re-open something they've already read.
  List<StoryModel> get _categoryStories {
    return _selectedCategory == 'All'
        ? _stories
        : _stories.where((s) => s.categories.contains(_selectedCategory)).toList();
  }

  // The main swipeable feed: category-filtered with already-read stories
  // removed, so a story never repeats once the user has opened it.
  List<StoryModel> get _feedStories {
    return _categoryStories
        .where((s) => !ReadHistoryService.instance.isRead(s.id))
        .toList();
  }

  List<StoryModel> get _searchResults {
    final filtered = _categoryStories;
    if (_searchQuery.isEmpty) return filtered;
    final q = _searchQuery.toLowerCase();
    return filtered
        .where((s) =>
            s.headline.toLowerCase().contains(q) ||
            s.neutralSummary.toLowerCase().contains(q) ||
            s.sourceName.toLowerCase().contains(q) ||
            s.categories.any((c) => c.toLowerCase().contains(q)) ||
            s.country.toLowerCase().contains(q) ||
            s.region.toLowerCase().contains(q) ||
            s.outlets.any((o) => (o['name'] ?? '').toLowerCase().contains(q)))
        .toList();
  }

  @override
  void initState() {
    super.initState();
    _loadStories();
    // Re-filter the feed the instant a story is marked read (e.g. after
    // returning from the detail screen), and once persisted history has
    // finished loading from disk on cold start.
    ReadHistoryService.instance.readIds.addListener(_onReadHistoryChanged);
  }

  void _onReadHistoryChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    ReadHistoryService.instance.readIds.removeListener(_onReadHistoryChanged);
    _pageController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadStories({bool forceRefresh = false}) async {
    if (!mounted) return;
    final categories = _categories.skip(1).toList();

    // On cold start, render persisted news first. This prevents the splash
    // spinner from waiting on Render/network/feed latency. A live request
    // then updates the same screen as soon as it completes.
    if (!forceRefresh && _stories.isEmpty) {
      final cached = await LiveNewsService.loadCachedStories(categories);
      if (!mounted) return;
      if (cached.isNotEmpty) {
        _replaceStories(cached);
        setState(() {
          _loading = false;
          _errorMessage = null;
        });
      } else {
        setState(() => _loading = true);
      }
    }

    List<Map<String, dynamic>> raw = [];
    String? errorMessage;
    try {
      raw = await LiveNewsService.fetchLiveStories(categories);
    } on NewsServiceException catch (error) {
      errorMessage = error.message;
    }
    if (!mounted) return;
    if (raw.isNotEmpty) {
      _replaceStories(raw);
    }
    setState(() {
      _errorMessage = raw.isNotEmpty ? null : errorMessage;
      _loading = false;
      _refreshing = false;
    });
    _precacheFirstImages();

    // Warm every category in the background on app startup. The selected
    // category is not the only feed that gets loaded: each category receives
    // its own cached response so switching tabs is immediate and starts with
    // a useful batch of stories already in memory.
    if (!forceRefresh) {
      unawaited(_preloadCategoryStories());
    }
  }

  Future<void> _preloadCategoryStories() async {
    final categories = _categories.skip(1).toList();
    await Future.wait(
      categories.map((category) async {
        try {
          var raw = await LiveNewsService.fetchLiveStories(<String>[category]);
          if (raw.length < 10) {
            // A second request gives the backend another chance to pick up
            // slower feeds while keeping the app responsive.
            final refreshed = await LiveNewsService.fetchLiveStories(
              <String>[category],
              forceRefresh: true,
            );
            if (refreshed.length > raw.length) raw = refreshed;
          }
          if (!mounted || raw.isEmpty) return;
          _appendStories(raw);
          _precacheFirstImages();
        } catch (_) {
          // One category failing to warm must never block the other categories.
        }
      }),
      eagerError: false,
    );
  }

  void _replaceStories(List<Map<String, dynamic>> raw) {
    final parsed = <StoryModel>[];
    final seenClusters = <String>{};
    final seenIds = <String>{};
    for (final item in raw) {
      try {
        final story = StoryModel.fromMap(item);
        final cluster = story.storyClusterId.isNotEmpty ? story.storyClusterId : story.id;
        if (seenIds.add(story.id) && seenClusters.add(cluster)) parsed.add(story);
      } on FormatException {
        // Skip malformed backend records.
      }
    }
    _stories = parsed;
  }

  void _precacheFirstImages() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      for (final story in _feedStories.take(3)) {
        if (story.imageUrl.isEmpty) continue;
        precacheImage(
          CachedNetworkImageProvider(
            story.imageUrl,
            headers: const {
              'User-Agent': 'Mozilla/5.0 (Android) AppleWebKit/537.36 Chrome/120 Safari/537.36',
              'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            },
          ),
          context,
        );
      }
    });
  }

  Future<void> _refreshStories() async {
    if (_refreshing) return;
    setState(() => _refreshing = true);
    if (_selectedCategory == 'All') {
      await _loadStories(forceRefresh: true);
    } else {
      await _loadMoreStories(forceRefresh: true);
      if (mounted) setState(() => _refreshing = false);
    }
  }

  Future<void> _selectCategory(String category) async {
    if (category == _selectedCategory) return;
    setState(() {
      _selectedCategory = category;
      _errorMessage = null;
      _loadingMore = false;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _pageController.hasClients) {
        _pageController.jumpToPage(0);
      }
    });
    if (category != 'All') {
      await _loadMoreStories(forceRefresh: true);
    }
  }

  Future<void> _loadMoreStories({bool forceRefresh = false}) async {
    if (!mounted || _loadingMore) return;
    final category = _selectedCategory;
    if (category == 'All') return;

    setState(() => _loadingMore = true);
    try {
      final raw = await LiveNewsService.fetchLiveStories(
        <String>[category],
        forceRefresh: forceRefresh,
      );
      if (!mounted || category != _selectedCategory) return;
      _appendStories(raw);
      setState(() {
        _errorMessage = null;
        _loadingMore = false;
        _refreshing = false;
      });
      _precacheFirstImages();
    } on NewsServiceException catch (error) {
      if (!mounted || category != _selectedCategory) return;
      setState(() {
        _errorMessage = error.message;
        _loadingMore = false;
        _refreshing = false;
      });
    }
  }

  void _appendStories(List<Map<String, dynamic>> raw) {
    final existingIds = _stories.map((s) => s.id).toSet();
    final existingClusters = _stories
        .map((s) => s.storyClusterId.isNotEmpty ? s.storyClusterId : s.id)
        .toSet();
    final additions = <StoryModel>[];
    for (final item in raw) {
      try {
        final story = StoryModel.fromMap(item);
        final cluster = story.storyClusterId.isNotEmpty ? story.storyClusterId : story.id;
        if (existingIds.add(story.id) && existingClusters.add(cluster)) {
          additions.add(story);
        }
      } on FormatException {
        // Skip malformed records.
      }
    }
    if (additions.isNotEmpty) {
      setState(() => _stories = [..._stories, ...additions]);
    }
  }

  void _openStory(StoryModel story) {
    // Mark as read the moment the user opens it so it's removed from the
    // main feed on return, rather than only after they finish reading.
    ReadHistoryService.instance.markRead(story.id);
    context.push(AppRoutes.storyDetailScreen, extra: story.toMap());
  }

  // Tapping the app logo always jumps back to the very first article in
  // the current feed, resetting search/category filters so "first article"
  // is unambiguous.
  void _goToFirstArticle() {
    setState(() {
      _searching = false;
      _searchQuery = '';
      _searchController.clear();
      _selectedCategory = 'All';
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_pageController.hasClients) {
        _pageController.jumpToPage(0);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator(color: AppTheme.primary)),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: _searching ? _buildSearchView() : _buildFeedView(),
      ),
    );
  }

  Widget _buildFeedView() {
    final stories = _feedStories;
    return Column(
      children: [
        _buildAppBar(),
        _buildCategoryRow(),
        Expanded(
          child: stories.isEmpty
              ? _buildEmptyState(allRead: _categoryStories.isNotEmpty)
              : RefreshIndicator(
                  onRefresh: _refreshStories,
                  child: PageView.builder(
                    controller: _pageController,
                    scrollDirection: Axis.vertical,
                    onPageChanged: (index) {
                      if (_selectedCategory != 'All' &&
                          index >= stories.length - 3) {
                        _loadMoreStories();
                      }
                    },
                    itemCount: stories.length +
                        (_selectedCategory != 'All' && _loadingMore ? 1 : 0),
                    itemBuilder: (_, index) {
                      if (index >= stories.length) {
                        return const Center(
                          child: CircularProgressIndicator(color: AppTheme.primary),
                        );
                      }
                      return _StoryPage(
                        story: stories[index],
                        onReadMore: () => _openStory(stories[index]),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }

  Widget _buildEmptyState({bool allRead = false}) {
    // Distinct from a fetch failure/empty result: there IS content for this
    // category, the user has just already read all of it.
    if (allRead && LiveNewsService.isConfigured && _errorMessage == null) {
      return EmptyStateWidget(
        icon: Icons.check_circle_outline_rounded,
        title: "You're all caught up",
        subtitle: "You've read every story in this category. Check back "
            'later for new coverage, or pull to refresh.',
        ctaLabel: 'Refresh',
        onCta: _refreshStories,
      );
    }
    final title = LiveNewsService.isConfigured
        ? (_errorMessage ?? 'No stories found.')
        : 'News service not configured';
    final subtitle = LiveNewsService.isConfigured
        ? 'Please try again.'
        : 'Connect the app to your HTTPS news backend with BACKEND_BASE_URL.';
    return EmptyStateWidget(
      icon: Icons.newspaper_rounded,
      title: title,
      subtitle: subtitle,
      ctaLabel: 'Try again',
      onCta: _loadStories,
    );
  }

  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          GestureDetector(
            onTap: _goToFirstArticle,
            child: Semantics(
              button: true,
              label: 'Truth logo, go to first article',
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.asset(
                  'assets/images/app_logo.png',
                  width: 34,
                  height: 34,
                  fit: BoxFit.cover,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: _goToFirstArticle,
            child: Semantics(
              button: true,
              label: 'Truth, go to first article',
              child: Text(
                'Truth',
                style: GoogleFonts.manrope(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
          const Spacer(),
          IconButton(
            tooltip: 'Search',
            onPressed: () => setState(() => _searching = true),
            icon: const Icon(Icons.search_rounded, color: Colors.white),
          ),
          IconButton(
            tooltip: 'Saved stories',
            onPressed: () => context.push(AppRoutes.bookmarksScreen),
            icon: const Icon(Icons.bookmark_border_rounded, color: Colors.white),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryRow() {
    return SizedBox(
      height: 46,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: _categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, index) {
          final category = _categories[index];
          final selected = category == _selectedCategory;
          return ChoiceChip(
            label: Text(category),
            selected: selected,
            onSelected: (_) => _selectCategory(category),
            backgroundColor: Colors.white,
            selectedColor: AppTheme.primary,
            checkmarkColor: Colors.black,
            labelStyle: GoogleFonts.manrope(
              color: Colors.black,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
            side: BorderSide.none,
          );
        },
      ),
    );
  }

  Widget _buildSearchView() {
    final results = _searchResults;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(8),
          child: Row(
            children: [
              IconButton(
                onPressed: () => setState(() {
                  _searching = false;
                  _searchQuery = '';
                  _searchController.clear();
                }),
                icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
              ),
              Expanded(
                child: TextField(
                  controller: _searchController,
                  autofocus: true,
                  onChanged: (value) => setState(() => _searchQuery = value.trim()),
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    hintText: 'Search current news',
                    hintStyle: TextStyle(color: Colors.white38),
                    prefixIcon: Icon(Icons.search_rounded, color: Colors.white54),
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: results.isEmpty
              ? Center(
                  child: Text(
                    _searchQuery.isEmpty ? 'Search for a story.' : 'No stories found.',
                    style: const TextStyle(color: Colors.white54),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: results.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, index) => ListTile(
                    tileColor: const Color(0xFF151515),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    title: Text(results[index].headline, style: const TextStyle(color: Colors.white)),
                    subtitle: Text(
                      results[index].sourceName,
                      style: const TextStyle(color: Colors.white54),
                    ),
                    onTap: () => _openStory(results[index]),
                  ),
                ),
        ),
      ],
    );
  }
}

class _StoryPage extends StatelessWidget {
  final StoryModel story;
  final VoidCallback onReadMore;

  const _StoryPage({required this.story, required this.onReadMore});

  String _shortSummary(String text) {
    final words = text.trim().split(RegExp(r'\s+'));
    return words.length <= 60 ? text : '${words.take(60).join(' ')}â€¦';
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Container(color: const Color(0xFF0A0A1A)),
        if (story.imageUrl.isNotEmpty)
          CustomImageWidget(
            imageUrl: story.imageUrl,
            fit: BoxFit.cover,
            semanticLabel: story.semanticLabel,
          ),
        Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.transparent, Colors.black87],
            ),
          ),
        ),
        Positioned(
          left: 20,
          right: 20,
          bottom: MediaQuery.of(context).padding.bottom + 24,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(story.category, style: const TextStyle(color: Colors.white, fontSize: 11)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      story.sourceName,
                      style: const TextStyle(color: Colors.white60, fontSize: 12),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                story.headline,
                style: GoogleFonts.manrope(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                _shortSummary(story.neutralSummary),
                style: const TextStyle(color: Colors.white70, height: 1.5),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  const Icon(Icons.source_rounded, size: 14, color: Colors.white54),
                  const SizedBox(width: 5),
                  Text('${story.outletCount} source${story.outletCount == 1 ? '' : 's'}', style: const TextStyle(color: Colors.white54, fontSize: 12)),
                  const Spacer(),
                  ElevatedButton.icon(
                    onPressed: onReadMore,
                    icon: const Icon(Icons.arrow_forward_rounded, size: 15),
                    label: const Text('Read More'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

