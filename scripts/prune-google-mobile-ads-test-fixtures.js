/**
 * Expo prebuild runs renameTemplateAppName with pattern "app.json" (matchBase),
 * which incorrectly matches react-native-google-mobile-ads test fixtures and
 * breaks native generation. Remove those fixture files after install.
 * @see https://github.com/invertase/react-native-google-mobile-ads/issues (Expo prebuild)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const fixturesDir = path.join(
  root,
  'node_modules',
  'react-native-google-mobile-ads',
  'plugin',
  '__tests__',
  'fixtures',
);
const tplExtract = path.join(root, '_tpl_extract');
const reproTpl = path.join(root, '_repro_tpl');
const tmpTpl = path.join(root, '_t');

try {
  if (fs.existsSync(fixturesDir)) {
    fs.rmSync(fixturesDir, { recursive: true, force: true });
    console.log('[postinstall] Removed react-native-google-mobile-ads/plugin/__tests__/fixtures for Expo prebuild.');
  }
  if (fs.existsSync(tplExtract)) {
    fs.rmSync(tplExtract, { recursive: true, force: true });
    console.log('[postinstall] Removed _tpl_extract (breaks Expo prebuild if left in the repo).');
  }
  if (fs.existsSync(reproTpl)) {
    fs.rmSync(reproTpl, { recursive: true, force: true });
    console.log('[postinstall] Removed _repro_tpl (template extract; breaks renameTemplateAppName globs).');
  }
  if (fs.existsSync(tmpTpl)) {
    fs.rmSync(tmpTpl, { recursive: true, force: true });
    console.log('[postinstall] Removed _t (temporary template extract).');
  }
} catch (e) {
  console.warn('[postinstall] Could not prune google-mobile-ads fixtures:', e.message);
}
