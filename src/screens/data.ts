import { backButton, el, muteButton, type App, type Unmount } from '../app';
import { sfx } from '../core/audio';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fileStamp(d = new Date()): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function mountData(app: App): Unmount {
  const screen = el('div', { class: 'screen screen--scroll' });
  const bar = el('div', { class: 'topbar' }, [
    backButton(app, 'title'),
    el('h2', {}, ['プレイ記録']),
    el('div', { class: 'spacer' }),
    muteButton(app),
  ]);

  const events = app.analytics.allEvents;
  const surveys = app.analytics.allSurveys;
  const notes = app.analytics.allNotes;
  const lastEvent = events.length ? events[events.length - 1] : null;

  const box = el('dl', { class: 'data-box' }, [
    el('dt', {}, ['匿名のローカル識別子']),
    el('dd', {}, [app.analytics.clientId]),
    el('dt', {}, ['記録されたイベント数']),
    el('dd', {}, [`${events.length} 件`]),
    el('dt', {}, ['気づきメモ']),
    el('dd', {}, [`${notes.length} 件`]),
    el('dt', {}, ['アンケート回答数']),
    el('dd', {}, [`${surveys.length} 件`]),
    el('dt', {}, ['最後の記録']),
    el('dd', {}, [lastEvent ? `${lastEvent.event} / ${lastEvent.ts}` : 'まだありません']),
  ]);

  /** チャットに貼って相談するための、短いテキスト要約を作る */
  function summaryText(): string {
    const lines: string[] = ['# レトロ修復工房 プレイ記録のまとめ'];
    const clears = events.filter((e) => e.event === 'stage_complete');
    lines.push('', '## クリア記録');
    if (clears.length === 0) lines.push('- まだクリアなし');
    for (const c of clears) {
      const sec = c.elapsedMs === null ? '?' : Math.round(c.elapsedMs / 1000);
      lines.push(`- ${c.stageId} / ${sec}秒 / ${c.ts}`);
    }
    lines.push('', '## 気づきメモ');
    if (notes.length === 0) lines.push('- なし');
    for (const n of notes) {
      const where = [n.stageTitle, n.stepTitle].filter(Boolean).join(' / ') || '場面不明';
      const tags = n.tags.length ? `[${n.tags.join('・')}] ` : '';
      lines.push(`- ${where}：${tags}${n.text || '(本文なし)'}`);
    }
    lines.push('', '## アンケート');
    if (surveys.length === 0) lines.push('- なし');
    for (const v of surveys) {
      lines.push(
        `- ${v.stageId}：面白さ${v.fun}/5・もう一度${v.playAgain ? 'はい' : 'いいえ'}・別の品物${v.wantMore ? 'はい' : 'いいえ'}${v.comment ? '・' + v.comment : ''}`,
      );
    }
    return lines.join('\n');
  }

  const copyBtn = el('button', { class: 'btn btn--block', type: 'button' }, ['まとめをコピーする']);
  const dlBtn = el('button', { class: 'btn btn--ghost btn--block', type: 'button' }, ['記録をJSONで保存する']);
  const status = el('p', { class: 'muted' }, ['']);

  copyBtn.addEventListener('click', async () => {
    sfx.ui();
    const textValue = summaryText();
    try {
      await navigator.clipboard.writeText(textValue);
      status.textContent = 'コピーしました。チャットに貼り付けて相談できます。';
      return;
    } catch {
      // クリップボードが使えない環境では、選んでコピーできるように出す
    }
    const area = el('textarea', { readonly: 'readonly', style: 'margin-top:10px;min-height:160px' }) as HTMLTextAreaElement;
    area.value = textValue;
    status.textContent = '自動コピーできませんでした。下の文章を長押しして選んでください。';
    status.after(area);
    area.focus();
    area.select();
  });

  dlBtn.addEventListener('click', () => {
    sfx.ui();
    try {
      const payload = app.analytics.exportPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: `retro-restoration-log-${fileStamp()}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      status.textContent = '保存しました（端末のダウンロードフォルダを確認してください）。';
    } catch {
      status.textContent = '保存に失敗しました。ブラウザの設定を確認してください。';
    }
  });

  // 誤操作を防ぐため2段階にする（ブラウザのダイアログは使わない）
  let armed = false;
  const clearBtn = el('button', { class: 'btn btn--ghost btn--block btn--sm', type: 'button' }, [
    'この端末の記録を消す',
  ]);
  clearBtn.addEventListener('click', () => {
    sfx.ui();
    if (!armed) {
      armed = true;
      clearBtn.textContent = '本当に消す（もう一度タップ）';
      window.setTimeout(() => {
        armed = false;
        clearBtn.textContent = 'この端末の記録を消す';
      }, 4000);
      return;
    }
    app.analytics.clearAll();
    status.textContent = 'プレイ記録とアンケート回答を消しました。';
    app.go('data');
  });

  screen.append(
    bar,
    el('p', { class: 'muted' }, [
      'このゲームは、遊ばれ方を知るために操作の記録をこの端末の中だけに保存しています。個人情報・位置情報・連絡先・広告IDは集めていません。',
    ]),
    box,
    el('div', { class: 'stack', style: 'margin-top:14px' }, [copyBtn, dlBtn, clearBtn]),
    status,
    el('p', { class: 'muted' }, [
      '記録は端末内（localStorage）にだけ残ります。自動で集計されることはないので、テストに協力していただける場合は、保存したJSONファイルを送ってください。電波のある所に戻ったら「まとめをコピーする」でそのまま相談に使えます。',
    ]),
  );
  app.root.append(screen);
  return () => undefined;
}
