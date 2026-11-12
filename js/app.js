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
import * as lights from './screens/lights.js';
import * as hands from './screens/hands.js';
import * as splits from './screens/splits.js';
import * as card from './screens/card.js';
import { dayKey } from './plan/decide.js';

const root = document.getElementById('app');

const screens = {
  install: setup.install,
  welcome: setup.welcome,
  dadpin: setup.dadPin,
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
  lights: lights.render,
  hands: hands.render,
  splits: splits.render,
  card: card.render,
};

export const app = {
  save: load(),
  room: null,
  screen: null,
  params: null,
  leave: null,
  pendingReload: false,
  drawn: null, // the date and hour the current screen was drawn: { day, early }
  persist() { save(this.save); },
  go(name, params = {}) {
    if (this.leave) { try { this.leave(); } catch {} this.leave = null; }
    if (name === 'home' && this.pendingReload) { location.reload(); return; }
    this.screen = name;
    this.params = params;
    this.drawn = stamp();
    root.onclick = null;
    window.scrollTo(0, 0);
    const out = screens[name](root, this, params);
    if (typeof out === 'function') this.leave = out;
  },
};

const stamp = (now = new Date()) => ({ day: dayKey(now), early: now.getHours() < 9 });

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

function boot() {
  if (isIOS() && !isStandalone() && !/[?&]web=1/.test(location.search)) { app.go('install'); return; }
  askToKeep();
  if (!app.save.setupDone) { app.go('welcome'); return; }
  // An unfinished session from the last 2 hours reopens on its Paused sheet.
  if (player.resumeIfAny?.(app)) return;
  app.go('home');
}

// Back on screen after a while: ask for a new version, and draw Today again if the day changed.
// A screen drawn last night still says yesterday's date and "Done for today". Never mid-session.
function onReturn() {
  if (document.hidden) return;
  try { navigator.serviceWorker?.getRegistration().then((r) => r?.update().catch(() => {})).catch(() => {}); } catch {}
  if (!app.save.setupDone || !app.drawn || app.screen === 'player' || app.screen === 'install') return;
  const now = stamp();
  if (now.day !== app.drawn.day) { app.room = null; app.go('home'); return; }
  // Today picks Bedroom before 9 am and Big room after, so redraw it when 9 am passes.
  if (app.screen === 'home' && now.early !== app.drawn.early) { app.room = null; app.go('home'); }
}
document.addEventListener('visibilitychange', onReturn);
window.addEventListener('pageshow', (e) => { if (e.persisted) onReturn(); });

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    // Switch to the new version on Today only, never mid-session.
    if (app.screen === 'home') location.reload();
    else app.pendingReload = true;
  });
}

boot();
