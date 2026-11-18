import { el, formatMs, muteButton, type App, type ScreenParams, type Unmount } from '../app';
import { sfx } from '../core/audio';
import { getStage, nextStageId, STAGES } from '../game/stages';
import { getToolDef, nextGoal } from '../game/tools';
import { openSurvey } from './survey';
import { renderThumb } from './thumb';

export function mountComplete(app: App, params: ScreenParams): Unmount {
  const stage = params.stageId ? getStage(params.stageId) : null;
  if (!stage) {
    app.go('select');
    return () => undefined;
  }

  const screen = el('div', { class: 'screen' });
  const bar = el('div', { class: 'topbar' }, [el('div', { class: 'spacer' }), muteButton(app)]);

  const before = el('canvas', {}) as HTMLCanvasElement;
  const after = el('canvas', {}) as HTMLCanvasElement;
  renderThumb(before, stage, 'before', 150);
  renderThumb(after, stage, 'after', 150);

  const compare = el('div', { class: 'compare' }, [
    el('figure', {}, [before, el('figcaption', {}, ['修復前'])]),
    el('figure', {}, [after, el('figcaption', {}, ['修復後'])]),
  ]);

  const nextId = nextStageId(stage.def.id);
  const actions = el('div', { class: 'title-actions' });

  if (nextId) {
    const nextStage = getStage(nextId);
    const nextBtn = el('button', { class: 'btn btn--block', type: 'button' }, [
      `次の品物へ：${nextStage?.def.title ?? ''}`,
    ]);
    nextBtn.addEventListener('click', () => {
      sfx.ui();
      app.go('play', { stageId: nextId, fromNext: true });
    });
    actions.append(nextBtn);
  } else {
    const allDone = STAGES.every((s) => app.save.isCleared(s.def.id));
    if (allDone) {
      actions.append(
        el('p', { class: 'muted' }, [`${STAGES.length}つすべての修復がおわりました。ありがとうございました！`]),
      );
    }
  }

  const retryBtn = el('button', { class: 'btn btn--ghost btn--block', type: 'button' }, ['もう一度修復する']);
  retryBtn.addEventListener('click', () => {
    sfx.ui();
    app.go('play', { stageId: stage.def.id, retry: true });
  });

  const collectionBtn = el('button', { class: 'btn btn--ghost btn--block', type: 'button' }, ['図鑑を見る']);
  collectionBtn.addEventListener('click', () => {
    sfx.ui();
    app.go('collection');
  });

  const selectBtn = el('button', { class: 'btn btn--ghost btn--block btn--sm', type: 'button' }, [
    'ステージ選択へ',
  ]);
  selectBtn.addEventListener('click', () => {
    sfx.ui();
    app.go('select');
  });

  const surveyBtn = el('button', { class: 'btn btn--ghost btn--block btn--sm', type: 'button' }, [
    'アンケートに答える（任意・30秒）',
  ]);
  surveyBtn.addEventListener('click', () => {
    sfx.ui();
    openSurvey(app, stage.def.id, (answered) => {
      if (answered) {
        surveyBtn.textContent = 'アンケートありがとうございました';
        surveyBtn.setAttribute('disabled', 'true');
      }
    });
  });

  actions.append(retryBtn, collectionBtn, selectBtn, surveyBtn);

  const timeText = params.clearedMs !== undefined ? `かかった時間 ${formatMs(params.clearedMs)}` : '';

  // お礼と、次に目指す道具（続けて遊ぶ理由）
  const rewardBox = el('div', { class: 'reward' });
  if (params.reward !== undefined) {
    rewardBox.append(
      el('p', { class: 'reward__gain' }, [`お礼 +${params.reward}円`]),
      el('p', { class: 'muted' }, [`所持金 ${app.save.money}円`]),
    );
  }
  const goal = nextGoal(app.save.money, app.save.toolLevels);
  if (goal) {
    const goalName = getToolDef(goal.toolId).levelNames[goal.nextLevel - 1];
    if (goal.short === 0) {
      const shopBtn = el('button', { class: 'btn btn--sm', type: 'button' }, ['道具屋へ']);
      shopBtn.addEventListener('click', () => {
        sfx.ui();
        app.go('tools', { back: 'select' });
      });
      rewardBox.append(el('p', { class: 'reward__goal' }, [`${goalName}が買えます！`]), shopBtn);
    } else {
      rewardBox.append(el('p', { class: 'reward__goal' }, [`あと${goal.short}円で ${goalName}`]));
    }
  }

  const wrap = el('div', { class: 'complete-wrap pop' }, [
    el('p', { class: 'title-sub' }, [params.firstClear ? '図鑑に登録しました' : 'もう一度きれいになりました']),
    el('h1', { class: 'complete-title' }, ['修復完了！']),
    el('p', { class: 'card__title' }, [stage.def.title]),
    compare,
    el('p', { class: 'muted' }, [timeText]),
    rewardBox,
    actions,
  ]);

  screen.append(bar, wrap);
  app.root.append(screen);

  // 初クリアのときだけ、アンケートを自動で出す（スキップ可）
  let timer = 0;
  if (params.firstClear) {
    timer = window.setTimeout(() => {
      openSurvey(app, stage.def.id, (answered) => {
        if (answered) {
          surveyBtn.textContent = 'アンケートありがとうございました';
          surveyBtn.setAttribute('disabled', 'true');
        }
      });
    }, 1400);
  }

  return () => {
    if (timer) window.clearTimeout(timer);
    document.querySelectorAll('.sheet').forEach((n) => n.remove());
  };
}
