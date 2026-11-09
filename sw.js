// Crease service worker: caches the whole app on first open so it works with no connection.
// tools/stamp.mjs rewrites the two lines below on every deploy.
const BUILD = '20261109-092455';
const PRECACHE = ["./","index.html","manifest.webmanifest","css/app.css","js/app.js","js/plan/build.js","js/screens/done.js","js/screens/drill.js","js/screens/home.js","js/screens/player.js","js/screens/settings.js","js/screens/setup.js","js/screens/start.js","js/store.js","js/timer/audio.js","js/timer/runner.js","js/timer/wakelock.js","js/ui.js","js/version.js","data/copy.js","data/demos.js","data/exercises.js","data/sessions.js","fonts/atkinson-400.ttf","fonts/atkinson-700.ttf","fonts/bigshoulders-800.ttf","fonts/bigshoulders-900.ttf","icons/crease-180.png","icons/crease-192.png","icons/crease-512.png","audio/01f45ed71a74.m4a","audio/06b76ddd175a.m4a","audio/07047837f875.m4a","audio/09b634e20052.m4a","audio/0a95c7c15824.m4a","audio/1462f487703e.m4a","audio/1551d6f4ab48.m4a","audio/15bf4ab4a111.m4a","audio/16f54942a581.m4a","audio/18cc82702069.m4a","audio/1a7725b2ce64.m4a","audio/1c8905c9e063.m4a","audio/1cc70ba53a17.m4a","audio/1d2171278e6b.m4a","audio/1e6585356a3a.m4a","audio/1eda7062f676.m4a","audio/21b85420fb2b.m4a","audio/25cd9e763cdd.m4a","audio/2687e7613c63.m4a","audio/2794de5cbdc7.m4a","audio/27de649b5b8f.m4a","audio/2a345470a35c.m4a","audio/2b44053818a7.m4a","audio/2b5a152b4801.m4a","audio/2be95364c2c4.m4a","audio/2bed70436348.m4a","audio/31ffa3e57e79.m4a","audio/33ce7d2d35ab.m4a","audio/36e9897d0030.m4a","audio/380c79da0d1d.m4a","audio/38fa4b970ea2.m4a","audio/398a77783320.m4a","audio/39f52ebfdd57.m4a","audio/39ff7fc02501.m4a","audio/3a26a7451a1e.m4a","audio/3aa676f73608.m4a","audio/3c3c6549867a.m4a","audio/3c4024325c85.m4a","audio/3d5fac327e7e.m4a","audio/41e6227bac5f.m4a","audio/42b85403cb3f.m4a","audio/45b6ae3ef52e.m4a","audio/4701ea0ee28e.m4a","audio/47b8beccc455.m4a","audio/498a6e7b3d4e.m4a","audio/49aefe1462f7.m4a","audio/4b4db2a5ea81.m4a","audio/4f97f28fe22f.m4a","audio/500e2f8564cf.m4a","audio/50f4060d9dae.m4a","audio/515a5383c7c5.m4a","audio/5210cf97cbd1.m4a","audio/566b2cf17a62.m4a","audio/597f48280a82.m4a","audio/5b169398a41c.m4a","audio/5bd97bd182eb.m4a","audio/5c015876adb9.m4a","audio/60563151d5ab.m4a","audio/60e9c1906e91.m4a","audio/6191746857f3.m4a","audio/65333fc67ce6.m4a","audio/6823afe25678.m4a","audio/685135ef9ddf.m4a","audio/6ace751c04c0.m4a","audio/6ad23c79e712.m4a","audio/6eaabb0fee5a.m4a","audio/71fa903c9dfa.m4a","audio/725660b6ea3c.m4a","audio/74a5717ff149.m4a","audio/763dc699c6a6.m4a","audio/77eaa5149621.m4a","audio/784990142826.m4a","audio/7c1e6532c26f.m4a","audio/7ceb266031e0.m4a","audio/7d0d59912f73.m4a","audio/7dab10260450.m4a","audio/82f9d18c5ba6.m4a","audio/853e9c64df80.m4a","audio/878f2ee5f0e1.m4a","audio/894968c1fc4a.m4a","audio/8ce87463634a.m4a","audio/8f9493cee50a.m4a","audio/8fa70edb9c48.m4a","audio/9129f5b5ef96.m4a","audio/931f89bac647.m4a","audio/9469acade022.m4a","audio/94f34504cf1a.m4a","audio/97bd16e62813.m4a","audio/990959dd48b2.m4a","audio/99b2d4cba1f5.m4a","audio/9b89453a3a91.m4a","audio/9bd5e3d05d86.m4a","audio/9efa3216722c.m4a","audio/a1ebae667b6d.m4a","audio/a2c602c948f5.m4a","audio/a32f7ddcd87f.m4a","audio/a3b87459b4f7.m4a","audio/a4d245a9bfa7.m4a","audio/a53719ab0e4e.m4a","audio/a7ea3a132b34.m4a","audio/a824b1b23b4b.m4a","audio/aad6661f4677.m4a","audio/ac82e5f15ea3.m4a","audio/ae0d06d15a75.m4a","audio/b205710b8e07.m4a","audio/b26650ce51a8.m4a","audio/b2ff2f77f6b8.m4a","audio/b518a3888094.m4a","audio/b5c4cb32e8ce.m4a","audio/b6617ceee2a0.m4a","audio/b877038b6032.m4a","audio/b8f77ac16a5e.m4a","audio/b9a2059fdf29.m4a","audio/ba0d1c0d5966.m4a","audio/ba38e28ef8b8.m4a","audio/bc54a73b8101.m4a","audio/bcbe3b752812.m4a","audio/bcf35c6fd381.m4a","audio/c27c813a9b61.m4a","audio/c2a1db79cf2e.m4a","audio/c5f1b8336aaf.m4a","audio/c5fc87e387da.m4a","audio/c68011bb8493.m4a","audio/c6c601d1e5b8.m4a","audio/c73b151c1342.m4a","audio/c810c9138104.m4a","audio/caa7a363c65a.m4a","audio/cec1f42b3d9a.m4a","audio/clips.json","audio/d0171d17e0b6.m4a","audio/d15489c01ca9.m4a","audio/d36c3328dfc2.m4a","audio/d5d7d181a987.m4a","audio/dbeb24c9e899.m4a","audio/dd306ea2a5e6.m4a","audio/dd9ba696ce86.m4a","audio/e0bfc7ee7c9e.m4a","audio/e77707ba11f1.m4a","audio/e8da1c68c9b6.m4a","audio/e90bd445a061.m4a","audio/ec8ce928222c.m4a","audio/ec9d8240a8ef.m4a","audio/ecd079b1ac9f.m4a","audio/ef5488b71200.m4a","audio/ef75a935f3bd.m4a","audio/f0ccbe1e3fa2.m4a","audio/f847b74dc2b5.m4a","audio/f8db1a0e0f68.m4a","audio/fa8527fe0030.m4a","audio/fb1870a01c0b.m4a","audio/fb2ba201a7a0.m4a","audio/ff527cc40396.m4a","media/draw/C1.webp","media/draw/C6.webp","media/draw/G1.webp","media/draw/G3.webp","media/draw/M1.webp","media/draw/M11.webp","media/draw/M2.webp","media/draw/M3.webp","media/draw/M4.webp","media/draw/M5.webp","media/draw/M6.webp","media/draw/M8.webp","media/draw/M9.webp","media/draw/P1.webp","media/draw/P10.webp","media/draw/P2.webp","media/draw/P3.webp","media/draw/P4.webp","media/draw/P5.webp","media/draw/P5q.webp","media/draw/P8.webp","media/draw/R7.webp","media/draw/S2.webp","media/draw/S3.webp","media/draw/W1.webp","media/draw/W2.webp","media/draw/W3.webp","media/draw/W4.webp","media/draw/W7.webp","media/draw/W8.webp","media/draw/W9.webp","media/draw/X3.webp","media/draw/X5.webp"];

const CACHE = `crease-${BUILD}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('crease-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html').then((page) => page || fetch(req));
      return fetch(req);
    })
  );
});
