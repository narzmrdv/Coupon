/**
 * Node's fs.cpSync/fs.promises.cp can crash (STATUS_STACK_BUFFER_OVERRUN) on Windows
 * when copying the native template into paths with non-ASCII characters. Use a
 * plain recursive copy on win32 instead.
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
  'utils',
  'dir.js',
);

const marker = 'copyTreeSyncWin32';

const replacement = `function copyTreeSyncWin32(src, dest) {
    const st = _fs().default.statSync(src);
    if (st.isDirectory()) {
        if (!_fs().default.existsSync(dest)) {
            _fs().default.mkdirSync(dest, {
                recursive: true
            });
        }
        for (const name of _fs().default.readdirSync(src)){
            if (name === '.' || name === '..') {
                continue;
            }
            copyTreeSyncWin32(_path().default.join(src, name), _path().default.join(dest, name));
        }
    } else {
        _fs().default.mkdirSync(_path().default.dirname(dest), {
            recursive: true
        });
        _fs().default.copyFileSync(src, dest);
    }
}
async function copyTreeAsyncWin32(src, dest) {
    const st = await _fs().default.promises.stat(src);
    if (st.isDirectory()) {
        try {
            await _fs().default.promises.mkdir(dest, {
                recursive: true
            });
        } catch  {}
        const names = await _fs().default.promises.readdir(src);
        await Promise.all(names.filter((n)=>n !== '.' && n !== '..').map((name)=>copyTreeAsyncWin32(_path().default.join(src, name), _path().default.join(dest, name))));
    } else {
        await _fs().default.promises.mkdir(_path().default.dirname(dest), {
            recursive: true
        });
        await _fs().default.promises.copyFile(src, dest);
    }
}
const copySync = (src, dest)=>{
    const destParent = _path().default.dirname(dest);
    if (!_fs().default.existsSync(destParent)) ensureDirectory(destParent);
    if (process.platform === 'win32') {
        copyTreeSyncWin32(src, dest);
        return;
    }
    _fs().default.cpSync(src, dest, {
        recursive: true,
        force: true
    });
};
const copyAsync = async (src, dest)=>{
    const destParent = _path().default.dirname(dest);
    if (!_fs().default.existsSync(destParent)) {
        await _fs().default.promises.mkdir(destParent, {
            recursive: true
        });
    }
    if (process.platform === 'win32') {
        await copyTreeAsyncWin32(src, dest);
        return;
    }
    await _fs().default.promises.cp(src, dest, {
        recursive: true,
        force: true
    });
};`;

const originalBlock = `const copySync = (src, dest)=>{
    const destParent = _path().default.dirname(dest);
    if (!_fs().default.existsSync(destParent)) ensureDirectory(destParent);
    _fs().default.cpSync(src, dest, {
        recursive: true,
        force: true
    });
};
const copyAsync = async (src, dest)=>{
    const destParent = _path().default.dirname(dest);
    if (!_fs().default.existsSync(destParent)) {
        await _fs().default.promises.mkdir(destParent, {
            recursive: true
        });
    }
    await _fs().default.promises.cp(src, dest, {
        recursive: true,
        force: true
    });
};`;

function patch() {
  if (!fs.existsSync(target)) {
    return;
  }
  let src = fs.readFileSync(target, 'utf8');
  if (src.includes(marker)) {
    return;
  }
  if (!src.includes('const copySync = (src, dest)=>')) {
    console.warn('[postinstall] patch-expo-cli-dir-win32-copy: copySync anchor not found, skip.');
    return;
  }
  if (!src.includes(originalBlock)) {
    console.warn('[postinstall] patch-expo-cli-dir-win32-copy: expected original block missing, skip.');
    return;
  }
  src = src.replace(originalBlock, replacement);
  fs.writeFileSync(target, src, 'utf8');
  console.log('[postinstall] Patched @expo/cli dir.js for win32 recursive copy (non-ASCII paths).');
}

try {
  patch();
} catch (e) {
  console.warn('[postinstall] patch-expo-cli-dir-win32-copy failed:', e.message);
}
