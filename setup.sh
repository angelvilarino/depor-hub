#!/usr/bin/env bash
# Crea apps/mobile (Expo SDK estable más reciente) y superpone la plantilla de template/mobile.
set -euo pipefail
cd "$(dirname "$0")"

node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22||(a===22&&b<13)){console.error("Necesitas Node >= 22.13 (tienes "+process.version+")");process.exit(1)}'

if [ -d apps/mobile ]; then echo "apps/mobile ya existe; nada que hacer."; exit 0; fi

mkdir -p apps
npx --yes create-expo-app@latest apps/mobile --template blank-typescript --no-install
rm -f apps/mobile/App.tsx apps/mobile/index.ts
cp -R template/mobile/. apps/mobile/

node - <<'JS'
const fs = require('fs');
const pkgPath = 'apps/mobile/package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = '@deporhub/mobile';
pkg.main = 'expo-router/entry';
pkg.scripts = {
  start: 'expo start',
  android: 'expo start --android',
  ios: 'expo start --ios',
  lint: 'expo lint',
  typecheck: 'tsc --noEmit',
  test: 'jest',
};
pkg.jest = { preset: 'jest-expo' };
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const appPath = 'apps/mobile/app.json';
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
const e = app.expo;
e.name = 'Depor Hub';
e.slug = 'depor-hub';
e.scheme = 'deporhub';
e.userInterfaceStyle = 'automatic';
e.plugins = Array.from(new Set([...(e.plugins || []), 'expo-router']));
// IDs provisionales: cambiar antes de publicar en tiendas (H9).
e.ios = { ...(e.ios || {}), bundleIdentifier: 'com.deporhub.app' };
e.android = { ...(e.android || {}), package: 'com.deporhub.app' };
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');
JS

npx expo install jest-expo jest eslint eslint-config-expo @testing-library/react-native -- --save-dev
npm install -D @types/jest
cd ../..
npm run lint
npm run typecheck
npm test -- --ci
echo "OK. Arranca con: npm run mobile"
