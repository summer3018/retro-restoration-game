# 道具の強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修復するとお礼のお金がもらえ、それで道具(布・磨き粉・ピンセット)を強化でき、強化すると修復が楽になる仕組みを足す。

**Architecture:** 数値とルールは純粋関数の `src/game/tools.ts` に集める。所持金と道具レベルは既存の `SaveStore` に足す(保存キーは `rrw.save.v1` のまま、欠けた項目は初期値で補う)。プレイ開始時に道具の効果を工程へ当て、新しい「道具屋」画面で買う。

**Tech Stack:** TypeScript / Vite / Canvas / DOM / Vitest(依存パッケージは増やさない)

**Spec:** `docs/superpowers/specs/2026-11-18-tools-upgrade-design.md`

## Global Constraints

- お礼: 初クリア **300円** / 再クリア **120円**
- 道具3種 × Lv1〜3(Lv1 は最初から持っている)。値段: Lv2 = **250円**、Lv3 = **600円**
- 効果: 布 拭く半径 ×1 / ×1.3 / ×1.6、磨き粉 必要な距離 ×1 / ×0.75 / ×0.5、ピンセット 吸い付く範囲 +0 / +12 / +24
- 7品物は最初から全部遊べる(解放の仕組みは入れない)
- 入れないもの: 広告・ガチャ・ログインボーナス・時間制限・品物の解放・工房の飾り・課金
- 依存パッケージを増やさない。画面の文言は短く平易な日本語
- 数字は `src/game/tools.ts` の定数1か所にまとめる

## Review Focus

1. 道具が入る前の保存データ(money・tools が無い)を読んでも、図鑑の記録が消えず、所持金0・道具Lv1で始まる → Task 2 にテスト
2. 所持金がちょうど値段と同じなら買え、1円足りなければ買えない。最高レベルではそれ以上買えず、お金も減らない → Task 2 にテスト
3. 壊れた値(tools.cloth = 99 / "abc"、money = -5 / NaN)は Lv1〜3・0以上に直して読む → Task 2 にテスト
4. 道具が全部 Lv3 でも、7品物すべて最後までクリアできる(磨きの進み具合は1を超えない) → Task 4 にテスト
5. お礼は1回のクリアにつき1回だけ入る(完了画面を開き直しても増えない) → Task 2 の `completeStage` のテスト + Task 4 で play.ts の呼び出しを1か所に限定

---

### Task 1: 道具のルール(純粋関数)

**Files:**
- Create: `src/game/tools.ts`
- Test: `tests/tools.test.ts`

**Interfaces:**
- Produces:
  - `type ToolId = 'cloth' | 'polish' | 'tweezers'`
  - `type ToolLevels = Record<ToolId, number>`
  - `const TOOL_IDS: ToolId[]`(この順: cloth, polish, tweezers)
  - `const MAX_TOOL_LEVEL = 3`
  - `const REWARD_FIRST = 300`, `const REWARD_REPEAT = 120`
  - `interface ToolDef { id: ToolId; name: string; levelNames: [string, string, string]; effectText: [string, string, string] }` と `const TOOLS: ToolDef[]`
    - 布: 名前「布」、段階名「古い布」「やわらかい布」「大きな布」
    - 磨き粉: 「磨き粉」、「ふつうの磨き粉」「よく効く磨き粉」「職人の磨き粉」
    - ピンセット: 「ピンセット」、「ふつうのピンセット」「磁石つきピンセット」「職人のピンセット」
    - effectText は効果を一言で(例「拭ける幅 1.3倍」「往復が 3/4 で済む」「部品が吸い付く範囲が広い」)
  - `defaultToolLevels(): ToolLevels`(全部1)
  - `rewardFor(firstClear: boolean): number`
  - `upgradeCost(currentLevel: number): number | null`(1→250、2→600、3以上→null)
  - `interface ToolEffects { brushScale: number; strokeScale: number; snapBonus: number }`
  - `toolEffects(levels: ToolLevels): ToolEffects`
  - `applyToolEffects(steps: RepairStep[], fx: ToolEffects): void`(PolishTask の strokeFactor に strokeScale を掛け、FitTask の各部品の snapRadius に snapBonus を足す)
  - `interface NextGoal { toolId: ToolId; nextLevel: number; cost: number; short: number }`
  - `nextGoal(money: number, levels: ToolLevels): NextGoal | null`(まだ上げられる道具のうち値段が最も安いもの、同じ値段なら TOOL_IDS の順。short = max(0, cost - money)。全部最高なら null)

- [ ] **Step 1: 失敗するテストを書く** `tests/tools.test.ts`
  - `rewardFor(true) === 300`、`rewardFor(false) === 120`
  - `upgradeCost(1) === 250`、`upgradeCost(2) === 600`、`upgradeCost(3) === null`
  - `toolEffects({cloth:1,polish:1,tweezers:1})` が `{brushScale:1, strokeScale:1, snapBonus:0}`
  - `toolEffects({cloth:3,polish:2,tweezers:3})` が `{brushScale:1.6, strokeScale:0.75, snapBonus:24}`
  - `applyToolEffects`: strokeFactor 8 の PolishTask と snapRadius 46 の部品を持つ FitTask に Lv3 の効果を当てると、strokeFactor 4・snapRadius 70
  - `nextGoal(0, 全部Lv1)` → `{toolId:'cloth', nextLevel:2, cost:250, short:250}`
  - `nextGoal(300, {cloth:2,polish:1,tweezers:1})` → `{toolId:'polish', nextLevel:2, cost:250, short:0}`
  - `nextGoal(0, 全部Lv3)` → `null`
- [ ] **Step 2:** `npx vitest run tests/tools.test.ts` → FAIL(モジュールが無い)
- [ ] **Step 3:** `src/game/tools.ts` を実装。あわせて `src/game/tasks.ts` の `PolishTask.strokeFactor` から `readonly` を外す(道具で上書きするため)
- [ ] **Step 4:** `npx vitest run tests/tools.test.ts` → PASS、`npx tsc --noEmit` → エラーなし
- [ ] **Step 5:** コミット `feat: 道具のルール(お礼・値段・効果)を追加`

### Task 2: 所持金と道具レベルの保存

**Files:**
- Modify: `src/core/storage.ts`(SaveData・read()・SaveStore)
- Test: `tests/storage.test.ts`(追記)

**Interfaces:**
- Consumes: Task 1 の `ToolId`, `ToolLevels`, `defaultToolLevels`, `upgradeCost`, `rewardFor`, `MAX_TOOL_LEVEL`
- Produces:
  - `SaveData` に `money: number` と `tools: ToolLevels` を追加(`version: 1` のまま)
  - `SaveStore.money: number`(getter)
  - `SaveStore.toolLevels: ToolLevels`(getter・コピーを返す)
  - `SaveStore.completeStage(stageId: string, elapsedMs: number, nowIso: string): { firstClear: boolean; reward: number }`(recordClear して、お礼を足して保存)
  - `type BuyResult = { ok: true; toolId: ToolId; level: number; cost: number } | { ok: false; reason: 'max' | 'short' }`
  - `SaveStore.buyUpgrade(toolId: ToolId): BuyResult`

- [ ] **Step 1: 失敗するテストを書く**(MemoryStore を使う)
  - 道具が入る前の形 `{"version":1,"collection":{"radio":{cleared:true,clearCount:2,bestMs:5000,firstClearedAt:"…"}},"settings":{"muted":true}}` を読む → `isCleared('radio')` が true、`muted` が true、`money` 0、`toolLevels` 全部1
  - 壊れた値 `money:-5` / `money:"abc"` → 0、`tools:{cloth:99, polish:"x", tweezers:0}` → `{cloth:3, polish:1, tweezers:1}`(整数に丸めて 1〜3 に収める)
  - `completeStage('radio', …)` 1回目 → `{firstClear:true, reward:300}`、money 300。2回目 → `{firstClear:false, reward:120}`、money 420。読み直しても 420
  - money 250 で `buyUpgrade('cloth')` → `{ok:true, toolId:'cloth', level:2, cost:250}`、money 0、読み直しても cloth 2
  - money 249 で `buyUpgrade('cloth')` → `{ok:false, reason:'short'}`、money 249 のまま
  - cloth 3 で money 9999 → `{ok:false, reason:'max'}`、money 9999 のまま
  - `resetAll()` で money 0・道具 全部1 に戻る
- [ ] **Step 2:** `npx vitest run tests/storage.test.ts` → 新しいテストが FAIL
- [ ] **Step 3:** 実装。`emptySave()` に money 0・tools 初期値を入れ、`read()` で欠け・壊れを補正する
- [ ] **Step 4:** `npx vitest run` → 全部 PASS(既存の 17 件も壊さない)
- [ ] **Step 5:** コミット `feat: 所持金と道具レベルを保存`

### Task 3: プレイ記録に「道具を買った」を足す

**Files:**
- Modify: `src/core/analytics.ts`
- Test: `tests/storage.test.ts`(analytics のテストがある所に追記)

**Interfaces:**
- Produces: `EventName` に `'tool_buy'`。`track()` の detail に `toolId?: string; level?: number; cost?: number` を足し、`LoggedEvent` に同名の省略可能な項目として残す(他のイベントには付けない)

- [ ] **Step 1: 失敗するテスト**: `track('tool_buy', { toolId:'cloth', level:2, cost:250 })` の戻り値と `exportPayload()` の events に `toolId:'cloth', level:2, cost:250` が入る。`track('stage_start', {stageId:'radio'})` には `toolId` のキー自体が無い
- [ ] **Step 2:** 実行して FAIL
- [ ] **Step 3:** 実装
- [ ] **Step 4:** `npx vitest run` → PASS
- [ ] **Step 5:** コミット `feat: プレイ記録に tool_buy を追加`

### Task 4: プレイに道具を効かせ、お礼を入れる

**Files:**
- Modify: `src/screens/play.ts`
- Modify: `src/app.ts`(`ScreenParams` に `reward?: number`)
- Test: `tests/playthrough.test.ts`(追記)

**Interfaces:**
- Consumes: Task 1 の `toolEffects`, `applyToolEffects`、Task 2 の `SaveStore.toolLevels`, `SaveStore.completeStage`
- Produces: 完了画面へ `app.go('complete', { stageId, clearedMs, firstClear, reward })`

- [ ] **Step 1: 失敗するテスト**(playthrough に追記): 7品物それぞれ、`build()` した工程に Lv3 の効果を当ててから `playStep` で通すと最後までクリアでき、`overallProgress` が 1(1を超えない)
- [ ] **Step 2:** 実行(applyToolEffects が Task 1 で入っていれば PASS する。FAIL なら原因を直す)
- [ ] **Step 3:** play.ts を変更
  - 工程を作った直後に `const fx = toolEffects(app.save.toolLevels); applyToolEffects(steps, fx);`
  - `brushRadius()` は `26 * fx.brushScale`
  - 完了時の `app.save.recordClear(...)` を `app.save.completeStage(...)` に置き換え(この1か所だけ)、`reward` を complete に渡す
- [ ] **Step 4:** `npx vitest run` と `npx tsc --noEmit` → PASS
- [ ] **Step 5:** コミット `feat: 道具の効果をプレイに反映し、クリアでお礼を受け取る`

### Task 5: 道具屋の画面と、タイトル・完了画面の案内

**Files:**
- Create: `src/screens/tools.ts`(`mountTools(app: App, params: ScreenParams): Unmount`)
- Modify: `src/app.ts`(`ScreenName` に `'tools'`、`ScreenParams` に `back?: 'title' | 'select'`)
- Modify: `src/main.ts`(`app.register('tools', (a, p) => mountTools(a, p))`)
- Modify: `src/screens/title.ts`(「道具屋」ボタンと所持金の表示)
- Modify: `src/screens/complete.ts`
- Modify: `src/style.css`(必要な分だけ)

**Interfaces:**
- Consumes: Task 1 の `TOOLS`, `upgradeCost`, `nextGoal`, `MAX_TOOL_LEVEL`、Task 2 の `money`, `toolLevels`, `buyUpgrade`、Task 3 の `track('tool_buy', …)`

- [ ] **Step 1: 道具屋の画面**
  - 上: もどるボタン(`params.back ?? 'title'` へ)・見出し「道具屋」・所持金「所持金 ○○円」
  - 道具ごとのカード(既存の card 系のクラスを使う): 道具名、今の段階名(例「やわらかい布」)、今の効果、次の段階の名前と効果、ボタン
  - ボタン: 買えるとき「○○円で買う」/ 足りないとき押せない「あと○○円」/ 最高のとき押せない「いちばん良い道具です」
  - 買えたら `sfx.snap()`、`app.analytics.track('tool_buy', {toolId, level, cost})`、「○○を手に入れた！」と短く出して画面を描き直す。連打しても `buyUpgrade` の結果どおりにしか減らない
- [ ] **Step 2: タイトル画面**: 「図鑑を見る」の下に「道具屋」ボタン(back: 'title')。所持金が1円以上なら「所持金 ○○円」を出す
- [ ] **Step 3: 完了画面**
  - 見出しの下に「お礼 +○○円」(params.reward があるとき)と「所持金 ○○円」
  - その下に次の目標: `nextGoal` が short 0 なら「○○(段階名)が買えます！」+「道具屋へ」ボタン(back: 'select')、short > 0 なら「あと○○円で ○○(段階名)」、null なら出さない
  - 既存の誤り「3つすべての修復がおわりました」を ``${STAGES.length}つすべての修復がおわりました`` に直す
- [ ] **Step 4:** `npx tsc --noEmit` と `npx vitest run` → PASS
- [ ] **Step 5: ブラウザで確認**(390×760、`localhost:5291`): ラジオをクリア → 完了画面に「お礼 +300円」「所持金 300円」「やわらかい布 が買えます！」→ 道具屋で布を買う → 所持金 50円・布が「やわらかい布」→ ラジオをもう一度遊んで拭き跡が広い → タイトルに所持金。リロードしても所持金と道具が残る。ページのエラー0件
- [ ] **Step 6:** コミット `feat: 道具屋の画面と、お礼・次の目標の表示を追加`

### Task 6: README と公開

**Files:**
- Modify: `README.md`(遊び方に「お礼と道具屋」、設計で効いているところ、テスト件数、未確認の項目、仕様で決めたこと)

- [ ] **Step 1:** README を更新(数字は Global Constraints のとおり)
- [ ] **Step 2:** `npm test` と `npm run build` → PASS
- [ ] **Step 3:** コミットして push。GitHub Actions が success、公開URLの JS に「道具屋」が含まれることを確認
