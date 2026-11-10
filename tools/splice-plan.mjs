// Replaces PLAN.md from "### 1.3" up to the rule before "## 2." with new text.
// Run from the Crease folder: node tools/splice-plan.mjs head.md library.md rest.md
import fs from 'node:fs';

const [head, lib, rest] = process.argv.slice(2).map((f) => fs.readFileSync(f, 'utf8'));
const plan = fs.readFileSync('PLAN.md', 'utf8');
const a = plan.indexOf('### 1.3 Exercise library');
const b = plan.indexOf('---\n\n## 2. Safety review');
if (a < 0 || b < 0 || b < a) { console.error('section markers not found'); process.exit(1); }
fs.writeFileSync('PLAN.md', plan.slice(0, a) + head + lib.trimEnd() + '\n\n' + rest + plan.slice(b));
console.log('spliced', b - a, 'chars out,', head.length + lib.length + rest.length, 'in');
