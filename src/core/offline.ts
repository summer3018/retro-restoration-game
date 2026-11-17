/**
 * オフライン対応（Service Worker）。
 *
 * ねらい: 電波のある所で一度開いておけば、圏外でも遊べる状態にする。
 * 開発中（npm run dev）は登録しない。キャッシュで古い画面が出ると混乱するため。
 */

let ready = false;

export const OFFLINE_READY_EVENT = 'rrw:offline-ready';

export function isOfflineReady(): boolean {
  return ready;
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;
  // file:// で開いた場合は Service Worker を使えない
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return;
  }

  const update = () => {
    const next = !!navigator.serviceWorker.controller;
    const changed = next !== ready;
    ready = next;
    document.documentElement.dataset.offlineReady = ready ? 'yes' : 'no';
    // タイトル画面はこの時点ですでに描かれているので、変化を知らせる
    if (changed) window.dispatchEvent(new CustomEvent(OFFLINE_READY_EVENT));
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        update();
        // 新しい版が来ていたら、次に開いたときに切り替わる
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed') update();
          });
        });
      })
      .catch(() => {
        /* 登録できなくてもオンラインなら遊べる */
      });

    navigator.serviceWorker.addEventListener('controllerchange', update);
    update();
  });
}
