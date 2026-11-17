import { el, type App } from '../app';
import { sfx } from '../core/audio';

/**
 * 遊びながら「気づいたこと」をその場で残すメモ。
 * 圏外でも書ける（localStorage に保存するだけ）。
 * あとでプレイ記録と一緒に書き出せる。
 */

const TAGS = ['操作しにくい', '分かりにくい', '長い', '短い', '音', '見た目', 'バグ', 'その他'];

export interface NoteContext {
  stageId: string | null;
  stageTitle: string | null;
  stepTitle: string | null;
}

export function openNoteSheet(app: App, ctx: NoteContext, onClose: (saved: boolean) => void): void {
  const picked = new Set<string>();

  const sheet = el('div', { class: 'sheet' });
  const panel = el('div', { class: 'sheet__panel pop' });

  const tagRow = el('div', { class: 'tag-row' });
  for (const t of TAGS) {
    const b = el('button', { class: 'choice choice--tag', type: 'button' }, [t]) as HTMLButtonElement;
    b.addEventListener('click', () => {
      if (picked.has(t)) {
        picked.delete(t);
        b.classList.remove('is-on');
      } else {
        picked.add(t);
        b.classList.add('is-on');
      }
      sfx.ui();
      refresh();
    });
    tagRow.append(b);
  }

  const text = el('textarea', {
    placeholder: '例：3つ目の歯車がうまくはまらなかった',
    maxlength: '500',
  }) as HTMLTextAreaElement;

  const save = el('button', { class: 'btn btn--block', type: 'button' }, ['メモを残す']) as HTMLButtonElement;
  const cancel = el('button', { class: 'btn btn--ghost btn--block', type: 'button' }, ['やめる']);

  function refresh(): void {
    save.disabled = picked.size === 0 && text.value.trim().length === 0;
  }
  text.addEventListener('input', refresh);
  refresh();

  function close(saved: boolean): void {
    sheet.remove();
    document.removeEventListener('keydown', onKey);
    onClose(saved);
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close(false);
  }

  save.addEventListener('click', () => {
    if (save.disabled) return;
    app.analytics.saveNote({
      stageId: ctx.stageId,
      stageTitle: ctx.stageTitle,
      stepTitle: ctx.stepTitle,
      tags: [...picked],
      text: text.value.trim(),
    });
    sfx.stepClear();
    close(true);
  });
  cancel.addEventListener('click', () => {
    sfx.ui();
    close(false);
  });
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) close(false);
  });
  document.addEventListener('keydown', onKey);

  const where = [ctx.stageTitle, ctx.stepTitle].filter(Boolean).join(' / ');

  panel.append(
    el('h3', {}, ['気づいたこと']),
    el('p', { class: 'muted' }, [where ? `いまの場面：${where}` : 'あとで見返せるように残しておきます']),
    el('div', { class: 'q' }, [el('p', { class: 'q__label' }, ['あてはまるものを選ぶ（任意・複数可）']), tagRow]),
    el('div', { class: 'q' }, [el('p', { class: 'q__label' }, ['ひとこと（任意）']), text]),
    el('div', { class: 'stack', style: 'margin-top:18px' }, [save, cancel]),
  );
  sheet.append(panel);
  document.body.append(sheet);
  text.focus();
}
