// Verifică faptul că fiecare text din interfață are traducere în rusă și în engleză.
// Caută apelurile t('…') și plural(n, '…', '…') / tp(…) din src/ și cheile din src/i18n/ru.ts și en.ts.
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

let failed = 0;

// Text românesc scris direct în JSX, fără t() — inclusiv amestecat cu expresii: „Expiră automat {data} dacă…”.
for (const p of files.filter((f) => f.endsWith('.tsx'))) {
  readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
    const st = line.trim();
    if (/^(\/\/|\*|\/\*|\{\/\*|import )/.test(st)) return;
    let x = line.replace(/\/\/.*$/, '');
    x = x.replace(/\bt\(\s*'(?:[^'\\]|\\.)*'(?:\s*,\s*\{[^}]*\})?\)/g, '');
    for (let k = 0; k < 3; k++) x = x.replace(/\{[^{}]*\}/g, '');
    x = x.replace(/(['"`])(?:(?!\1).)*\1/g, '').replace(/<[^>]*>/g, '');
    const words = x.match(/[A-Za-zĂÂÎȘȚăâîșțşţ]{2,}/g) ?? [];
    const romanian = words.some((w) => /[ăâîșțşţĂÂÎȘȚ]/.test(w));
    if (romanian && words.length >= 2 && !/(const|let|return|function|=>|===|type |interface )/.test(st)) {
      console.error(`Text netradus (fără t()): ${p}:${i + 1}: ${st.slice(0, 120)}`);
      failed++;
    }
  });
}
for (const [lang, file, pluralExport] of [['RU', 'src/i18n/ru.ts', 'RU_PLURALS'], ['EN', 'src/i18n/en.ts', 'EN_PLURALS']]) {
  const src = readFileSync(file, 'utf8');
  const [dictPart, pluralPart] = src.split(`export const ${pluralExport}`);
  const keys = new Set([...dictPart.matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gm)].map((m) => unq(m[1])));
  const pkeys = new Set([...pluralPart.matchAll(/^\s*'([^']*)':/gm)].map((m) => m[1]));
  const missing = [...used].filter(([k]) => !keys.has(k));
  const missingP = [...plurals].filter(([k]) => !pkeys.has(k));
  for (const [k, p] of missing) console.error(`Lipsește traducerea ${lang}: '${k}'  (${p})`);
  for (const [k, p] of missingP) console.error(`Lipsește pluralul ${lang}: '${k}'  (${p})`);
  failed += missing.length + missingP.length;
}
if (failed) {
  console.error(`\n${failed} texte fără traducere (src/i18n/ru.ts, src/i18n/en.ts).`);
  process.exit(1);
}
console.log(`i18n: ${used.size} texte și ${plurals.size} plurale au traducere în rusă și engleză.`);
