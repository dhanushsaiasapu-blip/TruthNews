# Contributing to Truth News

1. Pull the latest `main` branch.
2. Create a feature branch for your change.
3. Keep changes focused.
4. Run the relevant checks.
5. Test affected Android flows when applicable.

## Checks

```bash
flutter analyze
flutter test
node --check backend/server.mjs
```

## Commit messages

Use short, descriptive messages such as:

- `Fix category feed loading`
- `Improve article image extraction`
- `Add bookmark behavior`
- `Update source registry`

## Pull requests

Include what changed, why it changed, how it was tested, and screenshots for significant UI changes.

Never commit API keys, passwords, signing credentials, `.env` files containing secrets, or keystores.
