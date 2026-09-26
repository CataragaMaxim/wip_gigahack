// Verifică faptul că fiecare text din interfață are traducere în rusă.
// Caută apelurile t('…') și plural(n, '…', '…') / tp(…) din src/ și cheile din src/i18n/ru.ts.
// Rulează: npm run check:i18n (și în CI).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && !p.includes(join('src', 'i18n'))) files.push(p);
  }
};
walk('src');

const unq = (s) => s.replace(/\\'/g, "'");
const used = new Map();
const plurals = new Map();
for (const p of files) {
  const src = readFileSync(p, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) used.set(unq(m[1]), p);
  for (const m of src.matchAll(/\b(?:plural|tp)\(\s*[^,]+,\s*'([^']*)',\s*'([^']*)'\)/g)) plurals.set(`${m[1]}|${m[2]}`, p);
}

const ru = readFileSync('src/i18n/ru.ts', 'utf8');
const [dictPart, pluralPart] = ru.split('export const RU_PLURALS');
const keys = new Set([...dictPart.matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gm)].map((m) => unq(m[1])));
const pkeys = new Set([...pluralPart.matchAll(/^\s*'([^']*)':/gm)].map((m) => m[1]));

const missing = [...used].filter(([k]) => !keys.has(k));
const missingP = [...plurals].filter(([k]) => !pkeys.has(k));
for (const [k, p] of missing) console.error(`Lipsește traducerea RU: '${k}'  (${p})`);
for (const [k, p] of missingP) console.error(`Lipsește pluralul RU: '${k}'  (${p})`);
if (missing.length || missingP.length) {
  console.error(`\n${missing.length + missingP.length} texte fără traducere în src/i18n/ru.ts.`);
  process.exit(1);
}
console.log(`i18n: ${used.size} texte și ${plurals.size} plurale au traducere în rusă.`);
