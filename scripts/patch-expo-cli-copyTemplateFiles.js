/**
 * If `android/` exists but MainApplication is missing, Expo's copyTemplateFiles
 * skips copying the template (folder exists) and prebuild fails.
 * Patch @expo/cli to remove incomplete android trees before copy.
 */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  '@expo',
  'cli',
  'build',
  'src',
  'prebuild',
  'copyTemplateFiles.js',
);

const marker = 'hasMainApplicationUnderMainSrc';

const helperFn = `const debug = require('debug')('expo:prebuild:copyTemplateFiles');
function isIncompleteAndroidNative(androidProjectPath) {
    if (!_fs().default.existsSync(androidProjectPath)) {
        return false;
    }
    const mainSrc = _path().default.join(androidProjectPath, 'app', 'src', 'main');
    if (!_fs().default.existsSync(mainSrc)) {
        return true;
    }
    function hasMainApplicationUnderMainSrc(dir) {
        if (!_fs().default.existsSync(dir)) {
            return false;
        }
        const entries = _fs().default.readdirSync(dir, {
            withFileTypes: true
        });
        for (const ent of entries){
            const p = _path().default.join(dir, ent.name);
            if (ent.isDirectory()) {
                if (hasMainApplicationUnderMainSrc(p)) {
                    return true;
                }
            } else if (ent.name === 'MainApplication.java' || ent.name === 'MainApplication.kt') {
                return true;
            }
        }
        return false;
    }
    return !hasMainApplicationUnderMainSrc(mainSrc);
}
`;

const needle = `const debug = require('debug')('expo:prebuild:copyTemplateFiles');
`;

const forEachNeedle = `    platforms.forEach((copyFilePath)=>{
        const projectPath = _path().default.join(projectRoot, copyFilePath);
        if (_fs().default.existsSync(projectPath)) {`;

const forEachReplace = `    platforms.forEach((copyFilePath)=>{
        const projectPath = _path().default.join(projectRoot, copyFilePath);
        if (copyFilePath === 'android' && isIncompleteAndroidNative(projectPath)) {
            debug('Removing incomplete android folder (missing MainApplication under app/src/main) before copying template');
            _fs().default.rmSync(projectPath, {
                recursive: true,
                force: true
            });
        }
        if (_fs().default.existsSync(projectPath)) {`;

function patch() {
  if (!fs.existsSync(target)) {
    return;
  }
  let src = fs.readFileSync(target, 'utf8');
  if (src.includes(marker)) {
    if (!src.includes('missing MainApplication under app/src/main')) {
      src = src.replace(
        /debug\('Removing incomplete android folder \(missing app\/src\/main\/java\) before copying template'\)/,
        "debug('Removing incomplete android folder (missing MainApplication under app/src/main) before copying template')",
      );
      fs.writeFileSync(target, src, 'utf8');
    }
    return;
  }
  if (src.includes('isIncompleteAndroidNative')) {
    src = src.replace(
      /const debug = require\('debug'\)\('expo:prebuild:copyTemplateFiles'\);\s*function isIncompleteAndroidNative[\s\S]*?\n\}\n\/\*\*/,
      `${helperFn}/**`,
    );
    if (!src.includes(marker)) {
      console.warn('[postinstall] patch-expo-cli-copyTemplateFiles: upgrade replace failed, skip.');
      return;
    }
    fs.writeFileSync(target, src, 'utf8');
    console.log('[postinstall] Upgraded @expo/cli copyTemplateFiles patch (MainApplication check).');
    return;
  }
  if (!src.includes(needle)) {
    console.warn('[postinstall] patch-expo-cli-copyTemplateFiles: anchor not found, skip.');
    return;
  }
  src = src.replace(needle, helperFn);
  if (!src.includes(forEachNeedle)) {
    console.warn('[postinstall] patch-expo-cli-copyTemplateFiles: forEach anchor not found, skip.');
    return;
  }
  src = src.replace(forEachNeedle, forEachReplace);
  fs.writeFileSync(target, src, 'utf8');
  console.log('[postinstall] Patched @expo/cli copyTemplateFiles for incomplete android/ folders.');
}

try {
  patch();
} catch (e) {
  console.warn('[postinstall] patch-expo-cli-copyTemplateFiles failed:', e.message);
}
