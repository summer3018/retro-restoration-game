import './style.css';
import { App } from './app';
import { registerServiceWorker } from './core/offline';
import { mountCollection } from './screens/collection';
import { mountComplete } from './screens/complete';
import { mountData } from './screens/data';
import { mountPlay } from './screens/play';
import { mountStageSelect } from './screens/stageSelect';
import { mountTitle } from './screens/title';

const root = document.getElementById('app');
if (!root) throw new Error('#app が見つかりません');

const app = new App(root);
app.register('title', (a) => mountTitle(a));
app.register('select', (a) => mountStageSelect(a));
app.register('play', (a, p) => mountPlay(a, p));
app.register('complete', (a, p) => mountComplete(a, p));
app.register('collection', (a) => mountCollection(a));
app.register('data', (a) => mountData(a));

app.go('title');

// 圏外でも遊べるようにする（本番ビルドのときだけ）
registerServiceWorker();
