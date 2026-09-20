# Truth News

Truth News is a multisource news reader built with Flutter and Node.js. It brings current stories from multiple news outlets into a fast, category-based reading experience.

## Features

- Multisource news feed
- Categories: All, World, Politics, Business, Technology, Science, and Health
- Infinite scrolling for category feeds
- Preloading of stories across categories for faster navigation
- Read history and persistent seen-story tracking
- Bookmarks
- Source/outlet context and political-lean metadata
- Original article links
- Story clustering and duplicate suppression
- Feed and response caching
- Image extraction and high-resolution image handling
- Search across available stories
- Backend retry, timeout, and temporary-error handling

## Tech stack

- **Frontend:** Flutter / Dart
- **Backend:** Node.js
- **News data:** RSS/feed sources and source-specific integrations
- **Android:** Flutter Android project

## Project structure

```text
TruthNews/
├── lib/                 # Flutter application code
├── android/             # Android platform project
├── ios/                 # iOS platform project
├── web/                 # Flutter web project
├── assets/              # App assets
├── backend/             # Node.js news API and feed aggregation
├── docs/                # Project documentation
├── pubspec.yaml         # Flutter project metadata
└── README.md
```

## Getting started

### Prerequisites

- Flutter SDK
- Dart SDK (included with Flutter)
- Node.js and npm
- Android Studio / Android SDK for Android development

Check Flutter:

```bash
flutter doctor
```

### Run the backend

From `backend`:

```bash
npm install
node server.mjs
```

Production API:

```text
https://truth-news-api.onrender.com
```

### Run the Flutter app

From the project root:

```bash
flutter pub get
flutter run
```

Build Android release:

```bash
flutter build apk --release
```

## Development checks

```bash
flutter analyze
flutter test
node --check backend/server.mjs
```

When changing news-feed behavior, test initial loading, category switching, infinite scrolling, refresh, bookmarks, read/seen history, article links, slow-network behavior, and image loading.

## Security

Do not commit API keys, passwords, access tokens, signing credentials, keystores, `.env` files containing secrets, or generated build output. The repository `.gitignore` is configured to exclude common sensitive/generated files.

## Contributions

Issues and pull requests are welcome. For larger changes, open an issue first so the proposed behavior can be discussed before implementation.

## License

License information has not yet been selected for this project.
