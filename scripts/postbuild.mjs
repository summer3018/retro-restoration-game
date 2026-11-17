/*
 * ビルド後の仕上げ。
 * dist の中にある実ファイル名（ハッシュ付き）を Service Worker に書き込んで、
 * 「一度開けば、あとは圏外でも遊べる」状態を作る。
 *
 * 外部パッケージは使わない（Node 標準のみ）。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const swPath = join(dist, 'sw.js');

if (!existsSync(swPath)) {
  console.error('[postbuild] dist/sw.js が見つかりません。先に vite build を実行してください。');
  process.exit(1);
}

/** dist の中のファイルを再帰的に集める */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const EXCLUDE = new Set(['sw.js']);

const files = walk(dist)
  .map((f) => relative(dist, f).split(sep).join('/'))
  .filter((f) => !EXCLUDE.has(f))
  .sort();

// キャッシュに入れる一覧（相対パスにして、サブディレクトリ配信でも動くようにする）
const precache = ['./', ...files.map((f) => `./${f}`)];

// 版が変わったら古いキャッシュを捨てたいので、中身からIDを作る
const buildId = files
  .filter((f) => f.startsWith('assets/'))
  .map((f) => f.replace(/^assets\//, ''))
  .join('|') || String(Date.now());

let sw = readFileSync(swPath, 'utf8');
sw = sw.replace('__BUILD_ID__', buildId.replace(/[^A-Za-z0-9._|-]/g, ''));
sw = sw.replace(
  /const PRECACHE = \[[^\]]*\];/,
  `const PRECACHE = ${JSON.stringify(precache, null, 2).replace(/\n/g, '\n')};`,
);
writeFileSync(swPath, sw, 'utf8');

console.log(`[postbuild] sw.js にキャッシュ対象 ${precache.length} 件を書き込みました`);
for (const f of precache) console.log(`           ${f}`);
