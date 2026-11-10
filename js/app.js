// Crease: start-up and moving between screens.
import { load, save, askToKeep } from './store.js';
import * as setup from './screens/setup.js';
import * as home from './screens/home.js';
import * as start from './screens/start.js';
import * as drill from './screens/drill.js';
import * as player from './screens/player.js';
import * as done from './screens/done.js';
import * as settings from './screens/settings.js';
import * as dad from './screens/dad.js';

const root = document.getElementById('app');

const screens = {
  install: setup.install,
  welcome: setup.welcome,
  gear: setup.gear,
  sound: setup.sound,
  home: home.render,
  checkin: start.checkin,
  preview: start.preview,
  dad: dad.render,
  drill: drill.render,
  player: player.render,
  done: done.render,
  settings: settings.render,
};

export const app = {
  save: load(),
  room: null,
  screen: null,
  params: null,
  leave: null,
  pendingReload: false,
  persist() { save(this.save); },
  go(name, params = {}) {
    if (this.leave) { try { this.leave(); } catch {} this.leave = null; }
    if (name === 'home' && this.pendingReload) { location.reload(); return; }
    this.screen = name;
    this.params = params;
    root.onclick = null;
    window.scrollTo(0, 0);
    const out = screens[name](root, this, params);
    if (typeof out === 'function') this.leave = out;
  },
};

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

function boot() {
  if (isIOS() && !isStandalone() && !/[?&]web=1/.test(location.search)) { app.go('install'); return; }
  askToKeep();
  app.go(app.save.setupDone ? 'home' : 'welcome');
}

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (app.screen === 'home') location.reload();
    else app.pendingReload = true;
  });
}

boot();
