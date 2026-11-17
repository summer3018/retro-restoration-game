import { backButton, el, formatMs, muteButton, type App, type Unmount } from '../app';
import { sfx } from '../core/audio';
import { STAGES } from '../game/stages';
import { renderThumb } from './thumb';

export function mountStageSelect(app: App): Unmount {
  const screen = el('div', { class: 'screen screen--scroll' });
  const bar = el('div', { class: 'topbar' }, [
    backButton(app, 'title'),
    el('h2', {}, ['修復するものを選ぶ']),
    el('div', { class: 'spacer' }),
    muteButton(app),
  ]);

  const list = el('div', { class: 'card-list' });

  STAGES.forEach((stage, i) => {
    const rec = app.save.record(stage.def.id);
    const thumb = el('canvas', { class: 'card__thumb' }) as HTMLCanvasElement;
    renderThumb(thumb, stage, rec.cleared ? 'after' : 'before', 84);

    const metaBits: string[] = [stage.def.subtitle];
    if (rec.cleared && rec.bestMs !== null) metaBits.push(`最短 ${formatMs(rec.bestMs)}`);
    else metaBits.push('所要 1〜3分');

    const badge = rec.cleared
      ? el('span', { class: 'badge' }, ['修復ずみ'])
      : el('span', { class: 'badge badge--new' }, [i === 0 ? 'まずはここから' : '未修復']);

    const card = el('button', { class: 'card', type: 'button' }, [
      thumb,
      el('div', { class: 'card__body' }, [
        el('p', { class: 'card__title' }, [`${i + 1}. ${stage.def.title}`]),
        el('p', { class: 'card__meta' }, [metaBits.join(' ・ ')]),
        el('div', { class: 'row' }, [badge]),
      ]),
    ]);
    card.addEventListener('click', () => {
      sfx.ui();
      app.go('play', { stageId: stage.def.id, retry: rec.cleared });
    });
    list.append(card);
  });

  screen.append(
    bar,
    list,
    el('p', { class: 'muted' }, ['どれからでも遊べます。時間制限はなく、置き間違えても何度でもやり直せます。']),
  );
  app.root.append(screen);
  return () => undefined;
}
