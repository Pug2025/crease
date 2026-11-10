// Crease service worker: caches the whole app on first open so it works with no connection.
// tools/stamp.mjs rewrites the two lines below on every deploy.
const BUILD = '20261110-113521';
const PRECACHE = ["./","index.html","manifest.webmanifest","css/app.css","js/app.js","js/plan/build.js","js/plan/decide.js","js/screens/dad.js","js/screens/done.js","js/screens/drill.js","js/screens/home.js","js/screens/player.js","js/screens/settings.js","js/screens/setup.js","js/screens/start.js","js/store.js","js/timer/audio.js","js/timer/runner.js","js/timer/wakelock.js","js/ui.js","js/version.js","data/copy.js","data/demos.js","data/exercises.js","data/sessions.js","fonts/atkinson-400.ttf","fonts/atkinson-700.ttf","fonts/bigshoulders-800.ttf","fonts/bigshoulders-900.ttf","icons/crease-180.png","icons/crease-192.png","icons/crease-512.png","audio/04bf394b4b2f.m4a","audio/058179f0a33d.m4a","audio/0dfd4c2d7006.m4a","audio/0eaa4506b757.m4a","audio/11bd200a36a9.m4a","audio/13a9c24cd65f.m4a","audio/1424c1ae81e6.m4a","audio/14ef2ce92aee.m4a","audio/15205ad7c627.m4a","audio/15b9e3cf4042.m4a","audio/1633b44ac3bb.m4a","audio/1b9689759b84.m4a","audio/1befbfbbf004.m4a","audio/1c365f307817.m4a","audio/1c806d9d936f.m4a","audio/219c3b56c676.m4a","audio/223f66769d30.m4a","audio/25041c9e3b9b.m4a","audio/2ca4e2e78496.m4a","audio/2f7923f4e9fc.m4a","audio/307e7e1dd684.m4a","audio/332235d1c2ab.m4a","audio/3347d6761715.m4a","audio/35b2145946fa.m4a","audio/364e5a2310e1.m4a","audio/3aa366117acd.m4a","audio/3bc29fed2feb.m4a","audio/3cab517305e4.m4a","audio/3cedb2e7038d.m4a","audio/3d964ecbb6e4.m4a","audio/4033baa49a0e.m4a","audio/4230c35559fa.m4a","audio/46a3e5751b97.m4a","audio/4880a160b322.m4a","audio/48aac3c256f8.m4a","audio/48ab10a0b898.m4a","audio/4aaaede5330e.m4a","audio/4bdd510c82ec.m4a","audio/4e6996fc41bc.m4a","audio/4eac1838fddf.m4a","audio/4f34b510aedc.m4a","audio/4facd2a06221.m4a","audio/54e3746bfb45.m4a","audio/54e6074a043a.m4a","audio/5793f639fbfd.m4a","audio/58031c87a2d7.m4a","audio/5b6c870efab8.m4a","audio/5e806365117c.m4a","audio/5f429e11c7f9.m4a","audio/625f20b2ab39.m4a","audio/628fc4120323.m4a","audio/6532731510b2.m4a","audio/68df5de57304.m4a","audio/694d314cc81a.m4a","audio/69ac1dc0b07e.m4a","audio/6a0369f6027a.m4a","audio/6d2d20129dce.m4a","audio/6da460442b3b.m4a","audio/6f4a4e51dbc4.m4a","audio/737761347756.m4a","audio/7391d693480b.m4a","audio/77fc3980243e.m4a","audio/782436c302dc.m4a","audio/7a3f1b8bc196.m4a","audio/7dd1823f1a63.m4a","audio/7e4b4082273e.m4a","audio/7e824819b3ff.m4a","audio/8083c4fdb950.m4a","audio/816e39b30437.m4a","audio/837ee6b70ed3.m4a","audio/864ddf8c6883.m4a","audio/86cd7a6b7c61.m4a","audio/8734c2b38698.m4a","audio/897370482e99.m4a","audio/8dfd934de6a2.m4a","audio/8ec34e52808b.m4a","audio/940acf69ccc2.m4a","audio/97b0eac0fe84.m4a","audio/986fe0e1281b.m4a","audio/9880b60867fb.m4a","audio/994c86c07628.m4a","audio/9ccf5d38f70b.m4a","audio/9d6d2f01d7ce.m4a","audio/9de68f595d6f.m4a","audio/9e2471691610.m4a","audio/a039000fcb4f.m4a","audio/a118cef97e16.m4a","audio/a121b0d46bec.m4a","audio/a425f376f354.m4a","audio/a71e394c7a0a.m4a","audio/a7708c2ad6bf.m4a","audio/a8a3757582a7.m4a","audio/ac1af5b9f1ed.m4a","audio/aceb48f0e4b5.m4a","audio/ae06994bd0e9.m4a","audio/b1f70e5c4cb9.m4a","audio/b250a1734c13.m4a","audio/b284aebf1035.m4a","audio/b31aed77292b.m4a","audio/b33703184a52.m4a","audio/b59c3a3ca9a3.m4a","audio/b5cec6c0520c.m4a","audio/b814979b7f71.m4a","audio/bc6bfa0cd4c3.m4a","audio/bf8c0edc023b.m4a","audio/c0593728f08b.m4a","audio/c1a33ddb75bd.m4a","audio/c27a421d25e0.m4a","audio/c320e280334b.m4a","audio/c502848f76a1.m4a","audio/c63499001bb9.m4a","audio/c6fadb3c3d28.m4a","audio/cae615767ad6.m4a","audio/cbd381a6a896.m4a","audio/cbdcf77e8220.m4a","audio/ce8a7f38e7d5.m4a","audio/ceada1e0083d.m4a","audio/clips.json","audio/d00d734217f5.m4a","audio/d048be421180.m4a","audio/d069d66f740c.m4a","audio/d0be797f5d3d.m4a","audio/d1bc6d0ec97c.m4a","audio/d2ef4482429c.m4a","audio/d35c7d8f0ee7.m4a","audio/d7a033f66848.m4a","audio/dbc4104cfa21.m4a","audio/dd6f49cee393.m4a","audio/de67c45dacb8.m4a","audio/e38caf0d5205.m4a","audio/e3a19c406124.m4a","audio/e47d57364827.m4a","audio/e4e8338fbe20.m4a","audio/e5d2ffb9e2b9.m4a","audio/ea781a5531b0.m4a","audio/ebcc5e76c9a6.m4a","audio/ec54e1a0d9bf.m4a","audio/ed9ce0b49275.m4a","audio/ef3d0970fcd4.m4a","audio/f1960aebd129.m4a","audio/f21e57bc8db1.m4a","audio/f2f83934b128.m4a","audio/fe647e942095.m4a","audio/febff07ec718.m4a","audio/ffc93d2506e1.m4a","media/draw/C3.webp","media/draw/C9.webp","media/draw/G1.webp","media/draw/M1.webp","media/draw/M11.webp","media/draw/M3.webp","media/draw/M5.webp","media/draw/M6.webp","media/draw/P10.webp","media/draw/P11.webp","media/draw/P12.webp","media/draw/P12q.webp","media/draw/P13.webp","media/draw/P4.webp","media/draw/P8.webp","media/draw/S3.webp","media/draw/S4.webp","media/draw/ST1.webp","media/draw/ST2.webp","media/draw/ST3.webp","media/draw/ST4.webp","media/draw/W1.webp","media/draw/W2.webp","media/draw/W3.webp","media/draw/W4.webp","media/draw/W6.webp","media/draw/W7.webp","media/draw/X1.webp","media/draw/X3.webp","media/draw/X4.webp","media/draw/X5.webp","media/draw/X6.webp"];

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
