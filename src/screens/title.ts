import { el, muteButton, type App, type Unmount } from '../app';
import { sfx } from '../core/audio';
import { isOfflineReady, OFFLINE_READY_EVENT } from '../core/offline';
import { STAGES } from '../game/stages';
import { renderThumb } from './thumb';

export function mountTitle(app: App): Unmount {
  app.analytics.trackGameStartOnce();

  const screen = el('div', { class: 'screen' });

  const bar = el('div', { class: 'topbar' }, [el('div', { class: 'spacer' }), muteButton(app)]);

  const art = el('canvas', { class: 'title-art' }) as HTMLCanvasElement;
  const cleared = app.save.clearedCount;
  // タイトルの絵は、最後に修復した品物（なければラジオ）
  const showcase = [...STAGES].reverse().find((s) => app.save.isCleared(s.def.id)) ?? STAGES[0];
  renderThumb(art, showcase, 'after', 260);

  const offlineNote = el('p', { class: 'muted', id: 'offline-note' }, []);
  const renderOfflineNote = () => {
    offlineNote.textContent = isOfflineReady() ? '✓ 保存ずみ：電波がなくても遊べます' : '';
  };
  renderOfflineNote();
  window.addEventListener(OFFLINE_READY_EVENT, renderOfflineNote);

  const startLabel = cleared === 0 ? 'はじめる' : 'つづきから';
  const startBtn = el('button', { class: 'btn btn--block', type: 'button' }, [startLabel]);
  const collectionBtn = el('button', { class: 'btn btn--ghost btn--block', type: 'button' }, ['図鑑を見る']);
  const dataBtn = el('button', { class: 'btn btn--ghost btn--block btn--sm', type: 'button' }, [
    'プレイ記録（テスト協力者向け）',
  ]);

  startBtn.addEventListener('click', () => {
    sfx.ui();
    app.go('select');
  });
  collectionBtn.addEventListener('click', () => {
    sfx.ui();
    app.go('collection');
  });
  dataBtn.addEventListener('click', () => {
    sfx.ui();
    app.go('data');
  });

  const wrap = el('div', { class: 'title-wrap pop' }, [
    el('h1', { class: 'title-logo' }, ['レトロ修復工房']),
    el('p', { class: 'title-sub' }, ['ふるいものを、指でよみがえらせる']),
    art,
    el('div', { class: 'title-actions' }, [startBtn, collectionBtn, dataBtn]),
    el('p', { class: 'muted' }, [
      cleared === 0 ? '所要時間 1〜3分 / 1品' : `修復ずみ ${cleared} / ${STAGES.length} 品`,
    ]),
    offlineNote,
  ]);

  screen.append(bar, wrap);
  app.root.append(screen);
  return () => {
    window.removeEventListener(OFFLINE_READY_EVENT, renderOfflineNote);
  };
}
