# Shared Assets Policy

`shared/` is the canonical source for assets that must remain identical across
the web, iOS, and Android clients.

## Source of Truth

- `shared/brand/logo.svg` is the shared vector logo.
- `shared/brand/app-icon.png` is the master app icon image.
- `shared/brand/metadata.json` owns app display names, PWA manifest colors, and
  generated icon size lists.
- `shared/i18n/*.json` owns app copy for every supported locale.

Do not edit generated platform outputs directly unless you are debugging. Make
the source change under `shared/`, then run the generator.

## Generated Outputs

- Web: `public/logo.svg`, `public/icon-*.png`, `public/apple-touch-icon.png`,
  `public/manifest.json`, and `src/locales/*.ts`.
- iOS: `ios/NaSumShuttle/Resources/Assets.xcassets/Logo.imageset`,
  `AppIcon.appiconset`, and `ios/NaSumShuttle/Generated/RiderStringsGenerated.swift`.
- Android: `android/app/src/main/res/...` and
  `android/app/src/main/assets/logo.svg` when an Android project exists.

Generated outputs are committed so each platform can be opened and built without
running setup first.

## Commands

- `npm run shared:generate` regenerates all platform outputs from `shared/`.
- `npm run shared:check` regenerates outputs, validates key/placeholder parity,
  and fails if generated files differ from git.

Translation keys are stable dot-path API names. All locales must have the same
keys, and ICU placeholders such as `{count}` must match across locales.
