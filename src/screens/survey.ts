import { el, type App } from '../app';
import { sfx } from '../core/audio';

/**
 * 修復完了後の任意アンケート。
 * - スキップできる（回答を強制しない）
 * - 回答は localStorage に保存し、プレイ記録と一緒に JSON 出力できる
 */
export function openSurvey(app: App, stageId: string, onClose: (answered: boolean) => void): void {
  let fun: number | null = null;
  let playAgain: boolean | null = null;
  let wantMore: boolean | null = null;

  const sheet = el('div', { class: 'sheet' });
  const panel = el('div', { class: 'sheet__panel pop' });

  const submit = el('button', { class: 'btn btn--block', type: 'button' }, ['送信する']) as HTMLButtonElement;
  submit.disabled = true;

  function refresh(): void {
    submit.disabled = !(fun !== null && playAgain !== null && wantMore !== null);
  }

  function choiceGroup(
    labels: string[],
    onPick: (index: number) => void,
  ): HTMLElement {
    const group = el('div', { class: 'choices' });
    const buttons: HTMLButtonElement[] = [];
    labels.forEach((label, i) => {
      const b = el('button', { class: 'choice', type: 'button' }, [label]) as HTMLButtonElement;
      b.addEventListener('click', () => {
        buttons.forEach((x) => x.classList.remove('is-on'));
        b.classList.add('is-on');
        sfx.ui();
        onPick(i);
        refresh();
      });
      buttons.push(b);
      group.append(b);
    });
    return group;
  }

  const q1 = el('div', { class: 'q' }, [
    el('p', { class: 'q__label' }, ['1. このゲームは面白かったですか？']),
    choiceGroup(['1', '2', '3', '4', '5'], (i) => {
      fun = i + 1;
    }),
    el('p', { class: 'muted' }, ['1 = つまらない / 5 = とても面白い']),
  ]);

  const q2 = el('div', { class: 'q' }, [
    el('p', { class: 'q__label' }, ['2. もう一度遊びたいですか？']),
    choiceGroup(['はい', 'いいえ'], (i) => {
      playAgain = i === 0;
    }),
  ]);

  const q3 = el('div', { class: 'q' }, [
    el('p', { class: 'q__label' }, ['3. 別の品物も修復してみたいですか？']),
    choiceGroup(['はい', 'いいえ'], (i) => {
      wantMore = i === 0;
    }),
  ]);

  const comment = el('textarea', {
    placeholder: '例：部品が小さくて押しにくかった',
    maxlength: '500',
  }) as HTMLTextAreaElement;

  const q4 = el('div', { class: 'q' }, [
    el('p', { class: 'q__label' }, ['4. 改善してほしい点はありますか？（任意）']),
    comment,
  ]);

  const skip = el('button', { class: 'btn btn--ghost btn--block', type: 'button' }, ['スキップする']);

  function close(answered: boolean): void {
    sheet.remove();
    document.removeEventListener('keydown', onKey);
    onClose(answered);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close(false);
  }

  submit.addEventListener('click', () => {
    if (fun === null || playAgain === null || wantMore === null) return;
    app.analytics.saveSurvey({
      stageId,
      fun,
      playAgain,
      wantMore,
      comment: comment.value.trim(),
    });
    sfx.stepClear();
    close(true);
  });
  skip.addEventListener('click', () => {
    sfx.ui();
    close(false);
  });
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) close(false);
  });
  document.addEventListener('keydown', onKey);

  panel.append(
    el('h3', {}, ['かんたんアンケート']),
    el('p', { class: 'muted' }, ['答えなくても遊べます。あとからでも大丈夫です。']),
    q1,
    q2,
    q3,
    q4,
    el('div', { class: 'stack', style: 'margin-top:18px' }, [submit, skip]),
  );
  sheet.append(panel);
  document.body.append(sheet);
}
