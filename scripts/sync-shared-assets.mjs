#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkMode = process.argv.includes('--check');

const brandDir = path.join(root, 'shared/brand');
const i18nDir = path.join(root, 'shared/i18n');
const metadata = readJson(path.join(brandDir, 'metadata.json'));
const locales = readdirSync(i18nDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => path.basename(file, '.json'))
  .sort();

if (!locales.includes('en')) {
  throw new Error('shared/i18n/en.json is required for fallback generation.');
}

validateMetadata(metadata);

const localeData = Object.fromEntries(
  locales.map((locale) => [locale, readJson(path.join(i18nDir, `${locale}.json`))]),
);

validateLocales(localeData);
generateWeb();
generateIOS();
generateAndroidIfPresent();

if (checkMode) {
  runGitDiffCheck();
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function validateMetadata(value) {
  const requiredWebIcons = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512];
  const requiredIosIcons = [40, 58, 60, 80, 87, 120, 180, 1024];
  assertIncludesAll(value.webIcons, requiredWebIcons, 'shared/brand/metadata.json:webIcons');
  assertIncludesAll(value.iosAppIcons, requiredIosIcons, 'shared/brand/metadata.json:iosAppIcons');
}

function assertIncludesAll(actual, required, label) {
  if (!Array.isArray(actual)) {
    throw new Error(`${label} must be an array.`);
  }
  const missing = required.filter((size) => !actual.includes(size));
  if (missing.length) {
    throw new Error(`${label} is missing required icon sizes: ${missing.join(', ')}.`);
  }
}

function writeText(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, value);
}

function copyText(source, target) {
  writeText(target, readFileSync(source, 'utf8'));
}

function flatten(value, prefix = '', output = {}) {
  if (typeof value === 'string') {
    output[prefix] = value;
    return output;
  }

  if (Array.isArray(value)) {
    output[prefix] = value;
    return output;
  }

  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, output);
  }
  return output;
}

function placeholderSet(value) {
  if (typeof value !== 'string') {
    return [];
  }
  return [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

function validateLocales(dataByLocale) {
  const [baseLocale, ...otherLocales] = locales;
  const base = flatten(dataByLocale[baseLocale]);
  const baseKeys = Object.keys(base).sort();

  for (const locale of otherLocales) {
    const current = flatten(dataByLocale[locale]);
    const currentKeys = Object.keys(current).sort();
    const missing = baseKeys.filter((key) => !currentKeys.includes(key));
    const extra = currentKeys.filter((key) => !baseKeys.includes(key));
    if (missing.length || extra.length) {
      throw new Error(
        [
          `Locale key mismatch for ${locale}.`,
          missing.length ? `Missing: ${missing.join(', ')}` : '',
          extra.length ? `Extra: ${extra.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    for (const key of baseKeys) {
      const basePlaceholders = placeholderSet(base[key]).join(',');
      const currentPlaceholders = placeholderSet(current[key]).join(',');
      if (basePlaceholders !== currentPlaceholders) {
        throw new Error(
          `Placeholder mismatch for ${locale}:${key}. Expected [${basePlaceholders}], found [${currentPlaceholders}].`,
        );
      }
    }
  }
}

function generateWeb() {
  copyText(path.join(brandDir, 'logo.svg'), path.join(root, 'public/logo.svg'));

  const iconSource = path.join(brandDir, 'app-icon.png');
  for (const size of metadata.webIcons) {
    resizePng(iconSource, path.join(root, `public/icon-${size}x${size}.png`), size, {
      background: 'transparent',
    });
  }
  resizePng(iconSource, path.join(root, 'public/apple-touch-icon.png'), 180, {
    background: 'transparent',
  });

  const manifestSizes = metadata.webIcons.filter((size) => size >= 72 && size !== 180);
  writeText(
    path.join(root, 'public/manifest.json'),
    `${JSON.stringify(
      {
        short_name: metadata.shortName,
        name: metadata.appName,
        icons: manifestSizes.map((size) => ({
          src: `/icon-${size}x${size}.png`,
          sizes: `${size}x${size}`,
          type: 'image/png',
          purpose: size === 192 || size === 512 ? 'any maskable' : 'any',
        })),
        background_color: metadata.backgroundColor,
        theme_color: metadata.themeColor,
        start_url: metadata.startUrl,
        display: metadata.display,
      },
      null,
      2,
    )}\n`,
  );

  for (const locale of locales) {
    writeText(
      path.join(root, `src/locales/${locale}.ts`),
      `const ${locale} = ${JSON.stringify(toWebLocale(localeData[locale]), null, 2)} as const;\n\nexport default ${locale};\n`,
    );
  }
}

function toWebLocale(value) {
  if (typeof value === 'string') {
    return value.replace(/\{([A-Za-z0-9_]+)\}/g, '%{$1}');
  }
  if (Array.isArray(value)) {
    return value.map(toWebLocale);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, toWebLocale(child)]));
  }
  return value;
}

function generateIOS() {
  const assetsDir = path.join(root, 'ios/NaSumShuttle/Resources/Assets.xcassets');
  const logoDir = path.join(assetsDir, 'Logo.imageset');
  mkdirSync(logoDir, { recursive: true });
  copyText(path.join(brandDir, 'logo.svg'), path.join(logoDir, 'logo.svg'));
  writeText(
    path.join(logoDir, 'Contents.json'),
    `${JSON.stringify(
      {
        images: [{ filename: 'logo.svg', idiom: 'universal' }],
        info: { author: 'xcode', version: 1 },
        properties: { 'preserves-vector-representation': true },
      },
      null,
      2,
    )}\n`,
  );

  const appIconDir = path.join(assetsDir, 'AppIcon.appiconset');
  mkdirSync(appIconDir, { recursive: true });
  for (const file of readdirSync(appIconDir)) {
    if (/^AppIcon-\d+\.png$/.test(file)) {
      rmSync(path.join(appIconDir, file));
    }
  }
  const iconSource = path.join(brandDir, 'app-icon.png');
  for (const size of metadata.iosAppIcons) {
    resizePng(iconSource, path.join(appIconDir, `AppIcon-${size}.png`), size, {
      background: 'white',
    });
  }
  writeText(
    path.join(appIconDir, 'Contents.json'),
    `${JSON.stringify(
      {
        images: [
          { filename: 'AppIcon-40.png', idiom: 'iphone', scale: '2x', size: '20x20' },
          { filename: 'AppIcon-60.png', idiom: 'iphone', scale: '3x', size: '20x20' },
          { filename: 'AppIcon-58.png', idiom: 'iphone', scale: '2x', size: '29x29' },
          { filename: 'AppIcon-87.png', idiom: 'iphone', scale: '3x', size: '29x29' },
          { filename: 'AppIcon-80.png', idiom: 'iphone', scale: '2x', size: '40x40' },
          { filename: 'AppIcon-120.png', idiom: 'iphone', scale: '3x', size: '40x40' },
          { filename: 'AppIcon-120.png', idiom: 'iphone', scale: '2x', size: '60x60' },
          { filename: 'AppIcon-180.png', idiom: 'iphone', scale: '3x', size: '60x60' },
          { filename: 'AppIcon-1024.png', idiom: 'ios-marketing', scale: '1x', size: '1024x1024' },
        ],
        info: { author: 'xcode', version: 1 },
      },
      null,
      2,
    )}\n`,
  );

  const iosStrings = Object.fromEntries(
    locales.map((locale) => [
      locale,
      Object.fromEntries(
        Object.entries(flatten(localeData[locale])).filter(([, value]) => typeof value === 'string'),
      ),
    ]),
  );
  writeText(
    path.join(root, 'ios/NaSumShuttle/Generated/RiderStringsGenerated.swift'),
    renderSwiftStrings(iosStrings),
  );
}

function generateAndroidIfPresent() {
  const androidRes = path.join(root, 'android/app/src/main/res');
  if (!existsSync(androidRes)) {
    console.log('Android target absent; skipped Android resource generation.');
    return;
  }

  const iconSource = path.join(brandDir, 'app-icon.png');
  const densityIcons = {
    mdpi: 48,
    hdpi: 72,
    xhdpi: 96,
    xxhdpi: 144,
    xxxhdpi: 192,
  };
  for (const [density, size] of Object.entries(densityIcons)) {
    resizePng(iconSource, path.join(androidRes, `mipmap-${density}/ic_launcher.png`), size, {
      background: 'transparent',
    });
  }
  copyText(path.join(brandDir, 'logo.svg'), path.join(androidRes, 'drawable/logo.svg'));

  for (const locale of locales) {
    const valuesDir = locale === 'en' ? 'values' : `values-${locale}`;
    const strings = flatten(localeData[locale]);
    writeText(path.join(androidRes, valuesDir, 'strings.xml'), renderAndroidStrings(strings));
  }
}

function renderSwiftStrings(data) {
  const localeBlocks = Object.entries(data)
    .map(([locale, strings]) => {
      const rows = Object.entries(strings)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `            ${swiftString(key)}: ${swiftString(value)},`)
        .join('\n');
      return `        ${swiftString(locale)}: [\n${rows}\n        ],`;
    })
    .join('\n');

  return `// Generated by scripts/sync-shared-assets.mjs. Do not edit directly.\n\nimport Foundation\n\nenum RiderStringsGenerated {\n    static func text(_ key: String, language: AppLanguage, values: [String: String] = [:]) -> String {\n        let locale = language.rawValue\n        let template = strings[locale]?[key] ?? strings[\"en\"]?[key] ?? key\n        return values.reduce(template) { result, item in\n            result.replacingOccurrences(of: \"{\\(item.key)}\", with: item.value)\n        }\n    }\n\n    private static let strings: [String: [String: String]] = [\n${localeBlocks}\n    ]\n}\n`;
}

function renderAndroidStrings(strings) {
  const rows = Object.entries(strings)
    .filter(([, value]) => typeof value === 'string')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `    <string name="${androidName(key)}">${escapeXml(value)}</string>`)
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${rows}\n</resources>\n`;
}

function resizePng(source, target, size, { background }) {
  mkdirSync(path.dirname(target), { recursive: true });
  const magick = findCommand(['magick', 'convert']);
  if (magick) {
    const commonArgs = [
      source,
      '-background',
      background,
      '-alpha',
      background === 'white' ? 'remove' : 'on',
      '-alpha',
      background === 'white' ? 'off' : 'on',
      '-resize',
      `${size}x${size}!`,
      '-strip',
      '+set',
      'date:create',
      '+set',
      'date:modify',
      '-define',
      'png:exclude-chunk=time',
      target,
    ];
    execFileSync(magick, commonArgs, { stdio: 'ignore' });
    assertPngSize(target, size);
    return;
  }

  const sips = findCommand(['sips']);
  if (sips) {
    execFileSync(sips, ['-z', String(size), String(size), source, '--out', target], { stdio: 'ignore' });
    assertPngSize(target, size);
    return;
  }

  throw new Error('ImageMagick `magick`/`convert` or macOS `sips` is required to generate PNG assets.');
}

function findCommand(commands) {
  for (const command of commands) {
    const result = spawnSync('which', [command], { encoding: 'utf8' });
    if (result.status === 0) {
      return result.stdout.trim();
    }
  }
  return null;
}

function assertPngSize(file, expected) {
  const buffer = readFileSync(file);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width !== expected || height !== expected) {
    throw new Error(`${path.relative(root, file)} expected ${expected}x${expected}, found ${width}x${height}.`);
  }
}

function swiftString(value) {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function androidName(key) {
  return key.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
}

function runGitDiffCheck() {
  const paths = [
    'public',
    'src/locales',
    'ios/NaSumShuttle/Generated',
    'ios/NaSumShuttle/Resources/Assets.xcassets/Logo.imageset',
    'ios/NaSumShuttle/Resources/Assets.xcassets/AppIcon.appiconset',
  ];
  if (existsSync(path.join(root, 'android'))) {
    paths.push('android/app/src/main/res');
  }
  const result = spawnSync('git', ['diff', '--exit-code', '--', ...paths], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('Generated shared assets are out of date. Run `npm run shared:generate` and commit the results.');
  }
}
