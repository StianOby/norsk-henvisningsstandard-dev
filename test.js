// npm test: compare supported items with snapshots. Fails on any difference.
// npm run update: accept the current output as the new snapshots.
// npm run dev: print how the Under utvikling items render. Never fails.
// npm test and npm run update also write the [TEST] copy to test-style/, see export-test.js.
const fs = require('fs');
const path = require('path');
const { ZOTERO_CITEPROC, LANGS, buildStyles, loadItems, renderAll } = require('./lib');
const { writeTestStyle } = require('./export-test');

const SNAPSHOTS = path.join(__dirname, 'snapshots');
const mode = process.argv[2];

const styles = buildStyles();
const all = loadItems();
const supported = all.filter((i) => !i._dev);
const dev = all.filter((i) => i._dev);

if (mode === '--dev') {
  for (const [variant, style] of Object.entries(styles)) {
    console.log(`\n=== ${variant} (nb-NO)`);
    const { items } = renderAll(style, dev, 'nb-NO');
    for (const item of dev) {
      console.log(`\n${item.id}  ${item.title.slice(0, 70)}`);
      for (const [form, text] of Object.entries(items[item.id])) {
        console.log(`  ${form.padEnd(18)}${text}`);
      }
    }
  }
  process.exit(0);
}

function compare(expected, actual) {
  const diffs = [];
  const keys = new Set([...Object.keys(expected.items), ...Object.keys(actual.items)]);
  for (const key of keys) {
    const before = expected.items[key];
    const after = actual.items[key];
    if (!before || !after) {
      diffs.push(`${key}: ${before ? 'removed from fixtures' : 'not in snapshot'}`);
      continue;
    }
    for (const form of Object.keys(after)) {
      if (before[form] !== after[form]) {
        diffs.push(`${key} ${form}\n    - ${before[form]}\n    + ${after[form]}`);
      }
    }
  }
  if (JSON.stringify(expected.bibliography) !== JSON.stringify(actual.bibliography)) {
    diffs.push('shared bibliography: text or sort order changed');
  }
  return diffs;
}

console.log(`citeproc-js from Zotero ${ZOTERO_CITEPROC}`);
const { file: testStyle } = writeTestStyle();
console.log(`wrote ${path.relative(__dirname, testStyle)}`);

fs.mkdirSync(SNAPSHOTS, { recursive: true });
let failures = 0;
for (const [variant, style] of Object.entries(styles)) {
  for (const lang of LANGS) {
    const name = `${variant}.${lang}`;
    const file = path.join(SNAPSHOTS, `${name}.json`);
    const actual = renderAll(style, supported, lang);
    if (mode === '--update') {
      fs.writeFileSync(file, JSON.stringify(actual, null, 2) + '\n');
      console.log(`updated ${name}`);
      continue;
    }
    if (!fs.existsSync(file)) {
      console.log(`FAIL ${name}: no snapshot, run npm run update`);
      failures += 1;
      continue;
    }
    const diffs = compare(JSON.parse(fs.readFileSync(file, 'utf8')), actual);
    failures += diffs.length;
    console.log(`${diffs.length ? 'FAIL' : 'ok  '} ${name}: ${supported.length} items, ${diffs.length} differences`);
    diffs.forEach((d) => console.log(`  ${d}`));
  }
}
process.exit(failures ? 1 : 0);
