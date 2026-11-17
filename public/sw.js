/*
 * オフラインで遊べるようにするための Service Worker。
 *
 * 考え方:
 * - インストール時に、ゲームに必要なファイルを全部キャッシュに入れる
 *   （PRECACHE の中身は build のあとに scripts/postbuild.mjs が書き込む）
 * - HTML は「ネット優先・ダメならキャッシュ」→ 電波があれば更新が届く
 * - JS/CSS/画像は「キャッシュ優先」→ 圏外でも即表示
 *
 * ignoreVary について:
 *   配信サーバーが Vary ヘッダ（例: Vary: Origin）を付けると、
 *   既にキャッシュしてあるのに照合が一致せず、圏外で真っ白になる。
 *   ここでは URL だけで照合したいので、必ず ignoreVary: true を付ける。
 *
 * 注意: ビルド後に差し替わるので、このファイルを直接編集した内容は
 *       dist 側には反映されません（public/ が原本です）。
 */

const VERSION = '__BUILD_ID__';
const CACHE = `retro-restoration-${VERSION}`;
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // 1つでも失敗したら全部失敗、を避けるため個別に入れる
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // ページ本体: ネット優先（更新を受け取るため）、つながらなければキャッシュ
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() =>
          caches
            .match('./index.html', { ignoreVary: true })
            .then((r) => r || caches.match('./', { ignoreVary: true })),
        ),
    );
    return;
  }

  // それ以外: キャッシュ優先
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached),
    ),
  );
});

// 新しい版がある、と画面から言われたらすぐ切り替える
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
