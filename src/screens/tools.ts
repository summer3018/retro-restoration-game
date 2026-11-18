import { backButton, el, muteButton, type App, type ScreenParams, type Unmount } from '../app';
import { sfx } from '../core/audio';
import { getToolDef, MAX_TOOL_LEVEL, tapGate, TOOLS, upgradeCost, type ToolId } from '../game/tools';

/**
 * 道具屋。お礼のお金で、布・磨き粉・ピンセットを1段階ずつ良くする。
 */
export function mountTools(app: App, params: ScreenParams): Unmount {
  const back = params.back ?? 'title';
  const screen = el('div', { class: 'screen screen--scroll' });
  const moneyEl = el('span', { class: 'money' }, ['']);
  const bar = el('div', { class: 'topbar' }, [
    backButton(app, back),
    el('h2', {}, ['道具屋']),
    el('div', { class: 'spacer' }),
    moneyEl,
    muteButton(app),
  ]);
  const toast = el('p', { class: 'tool-toast', role: 'status' }, ['']);
  const list = el('div', { class: 'card-list' });

  let toastTimer = 0;
  function showToast(text: string): void {
    toast.textContent = text;
    toast.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-on'), 1800);
  }

  // 開いた直後・買った直後のすばやいタップは無視する（2段階いっぺんに買わないように）
  const canTap = tapGate(400);

  function buy(id: ToolId): void {
    if (!canTap()) return;
    const result = app.save.buyUpgrade(id);
    if (!result.ok) {
      // ボタンは押せない状態にしてあるが、連打などで来たときも何も減らさない
      render();
      return;
    }
    sfx.snap();
    app.analytics.track('tool_buy', { toolId: result.toolId, level: result.level, cost: result.cost });
    showToast(`${getToolDef(id).levelNames[result.level - 1]}を手に入れた！`);
    render();
  }

  function render(): void {
    const money = app.save.money;
    const levels = app.save.toolLevels;
    moneyEl.textContent = `所持金 ${money}円`;
    list.replaceChildren();

    for (const tool of TOOLS) {
      const lv = levels[tool.id];
      const icon = el('canvas', { class: 'tool-icon', width: '128', height: '128' }) as HTMLCanvasElement;
      drawToolIcon(icon, tool.id, lv);

      const dots = el('span', { class: 'tool-dots', 'aria-label': `レベル ${lv} / ${MAX_TOOL_LEVEL}` }, [
        '●'.repeat(lv) + '○'.repeat(MAX_TOOL_LEVEL - lv),
      ]);

      const body = el('div', { class: 'card__body' }, [
        el('p', { class: 'card__title' }, [tool.levelNames[lv - 1], ' ', dots]),
        el('p', { class: 'card__meta' }, [`いま：${tool.effectText[lv - 1]}`]),
      ]);

      const cost = upgradeCost(lv);
      let btn: HTMLButtonElement;
      if (cost === null) {
        btn = el('button', { class: 'btn btn--ghost btn--sm btn--block', type: 'button', disabled: 'true' }, [
          'いちばん良い道具です',
        ]) as HTMLButtonElement;
      } else {
        body.append(
          el('p', { class: 'card__meta tool-next' }, [
            `次：${tool.levelNames[lv]}（${tool.effectText[lv]}）`,
          ]),
        );
        if (money >= cost) {
          btn = el('button', { class: 'btn btn--sm btn--block', type: 'button' }, [`${cost}円で買う`]) as HTMLButtonElement;
          btn.addEventListener('click', () => buy(tool.id));
        } else {
          btn = el('button', { class: 'btn btn--ghost btn--sm btn--block', type: 'button', disabled: 'true' }, [
            `あと${cost - money}円`,
          ]) as HTMLButtonElement;
        }
      }
      body.append(btn);

      list.append(el('div', { class: 'card tool-card' }, [icon, body]));
    }
  }

  render();
  screen.append(
    bar,
    el('p', { class: 'muted' }, ['修復するとお礼がもらえます。道具を良くすると、修復が楽になります。']),
    list,
    toast,
  );
  app.root.append(screen);
  return () => window.clearTimeout(toastTimer);
}

/** 道具の小さな絵（Canvas で自作。レベルが上がると色が良くなる） */
function drawToolIcon(canvas: HTMLCanvasElement, id: ToolId, level: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = canvas.width / 64;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#1d140d';
  ctx.fillRect(0, 0, 64, 64);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (id === 'cloth') {
    const colors = ['#b9a98d', '#e7c9a0', '#f2d7b0'];
    const w = [30, 36, 44][level - 1];
    ctx.fillStyle = colors[level - 1];
    ctx.beginPath();
    ctx.moveTo(32 - w / 2, 22);
    ctx.quadraticCurveTo(32, 16, 32 + w / 2, 22);
    ctx.lineTo(32 + w / 2 - 3, 44);
    ctx.quadraticCurveTo(32, 50, 32 - w / 2 + 3, 44);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,30,0.55)';
    ctx.setLineDash([2, 2]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(32 - w / 2 + 4, 25);
    ctx.lineTo(32 + w / 2 - 4, 25);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (id === 'polish') {
    const lid = ['#8e8371', '#c9a85a', '#e9c46a'][level - 1];
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(18, 26, 28, 22);
    ctx.fillStyle = lid;
    ctx.beginPath();
    ctx.ellipse(32, 26, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f3e3c3';
    ctx.fillRect(21, 32, 22, 9);
    if (level >= 2) {
      ctx.fillStyle = 'rgba(255,240,200,0.9)';
      for (const [x, y] of [[47, 18], [51, 26], [14, 20]].slice(0, level)) {
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    const metal = ['#9a9a9a', '#c7cdd4', '#e8d08a'][level - 1];
    ctx.strokeStyle = metal;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(22, 14);
    ctx.lineTo(30, 50);
    ctx.moveTo(42, 14);
    ctx.lineTo(34, 50);
    ctx.stroke();
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.arc(32, 14, 10, Math.PI, 0);
    ctx.fill();
    if (level >= 2) {
      ctx.fillStyle = '#c94a3a';
      ctx.fillRect(27, 47, 10, 5);
    }
  }
}
