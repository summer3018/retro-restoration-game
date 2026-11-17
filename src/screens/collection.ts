import { backButton, el, formatMs, muteButton, type App, type Unmount } from '../app';
import { sfx } from '../core/audio';
import { STAGES } from '../game/stages';
import { renderSilhouette, renderThumb } from './thumb';

export function mountCollection(app: App): Unmount {
  const screen = el('div', { class: 'screen screen--scroll' });
  const bar = el('div', { class: 'topbar' }, [
    backButton(app, 'title'),
    el('h2', {}, ['修復図鑑']),
    el('div', { class: 'spacer' }),
    muteButton(app),
  ]);

  const cleared = app.save.clearedCount;
  const list = el('div', { class: 'card-list' });

  for (const stage of STAGES) {
    const rec = app.save.record(stage.def.id);

    const before = el('canvas', {}) as HTMLCanvasElement;
    const after = el('canvas', {}) as HTMLCanvasElement;
    renderThumb(before, stage, 'before', 130);
    if (rec.cleared) renderThumb(after, stage, 'after', 130);
    else renderSilhouette(after, stage, 130);

    const compare = el('div', { class: 'compare', style: 'margin-top:10px' }, [
      el('figure', {}, [before, el('figcaption', {}, ['修復前'])]),
      el('figure', {}, [after, el('figcaption', {}, [rec.cleared ? '修復後' : 'まだ修復していません'])]),
    ]);

    const meta: string[] = [];
    if (rec.cleared) {
      meta.push(`修復 ${rec.clearCount} 回`);
      if (rec.bestMs !== null) meta.push(`最短 ${formatMs(rec.bestMs)}`);
      if (rec.firstClearedAt) meta.push(`初修復 ${rec.firstClearedAt.slice(0, 10)}`);
    } else {
      meta.push('未修復');
    }

    const playBtn = el('button', { class: 'btn btn--ghost btn--block btn--sm', type: 'button' }, [
      rec.cleared ? 'もう一度修復する' : '修復をはじめる',
    ]);
    playBtn.addEventListener('click', () => {
      sfx.ui();
      app.go('play', { stageId: stage.def.id, retry: rec.cleared });
    });

    const item = el('div', { class: 'card', style: 'display:block' }, [
      el('div', { class: 'row' }, [
        el('div', { class: 'card__body' }, [
          el('p', { class: 'card__title' }, [stage.def.title]),
          el('p', { class: 'card__meta' }, [meta.join(' ・ ')]),
        ]),
        rec.cleared ? el('span', { class: 'badge' }, ['登録ずみ']) : el('span', { class: 'badge badge--new' }, ['未登録']),
      ]),
      compare,
      el('p', { class: 'card__meta', style: 'margin:10px 0' }, [
        rec.cleared ? stage.def.caption : '修復すると、ここに解説が出ます。',
      ]),
      playBtn,
    ]);
    list.append(item);
  }

  screen.append(
    bar,
    el('p', { class: 'muted' }, [`登録 ${cleared} / ${STAGES.length} 品`]),
    list,
  );
  app.root.append(screen);
  return () => undefined;
}
