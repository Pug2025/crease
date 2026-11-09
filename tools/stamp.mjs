// Writes the build stamp and the list of files to cache into sw.js and js/version.js.
// Run from the Crease folder: node tools/stamp.mjs <BUILD>
import fs from 'node:fs';
import path from 'node:path';

const build = process.argv[2] || 'dev';
const roots = ['index.html', 'manifest.webmanifest', 'css', 'js', 'data', 'fonts', 'icons', 'audio', 'media'];
const files = [];
const walk = (p) => {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p).sort()) { if (!f.startsWith('.')) walk(path.join(p, f)); }
  else files.push(p.split(path.sep).join('/'));
};
roots.forEach(walk);

let sw = fs.readFileSync('sw.js', 'utf8');
sw = sw.replace(/^const BUILD = .*;$/m, `const BUILD = '${build}';`);
sw = sw.replace(/^const PRECACHE = .*;$/m, `const PRECACHE = ${JSON.stringify(['./', ...files])};`);
fs.writeFileSync('sw.js', sw);
fs.writeFileSync('js/version.js', `export const BUILD = '${build}';\n`);
console.log(`stamped ${build}, ${files.length} files to cache`);
