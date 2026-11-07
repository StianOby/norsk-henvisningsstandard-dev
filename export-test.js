// Exports a test copy of the short note variant that installs next to the regular style in Zotero.
// The copy is the real builder's output, with only the three lines in EDITS changed.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const EXPORT = path.join(__dirname, 'export');
const TMP = path.join(EXPORT, 'tmp');
const BASE = 'norsk-henvisningsstandard-for-rettsvitenskapelige-tekster';
const ID = `http://www.zotero.org/styles/${BASE}`;
const TEST_ID = `${ID}-test`;

// Zotero overwrites an installed style that has the same ID, file name (the last part of the ID)
// or title. It also sends the self link to its style repository, so that has to change as well.
const EDITS = [
  ['<title>Norsk henvisningsstandard', '<title>[TEST] Norsk henvisningsstandard'],
  [`<id>${ID}</id>`, `<id>${TEST_ID}</id>`],
  [`<link href="${ID}" rel="self"/>`, `<link href="${TEST_ID}" rel="self"/>`],
];

// Runs the builder on the short note variant alone, in a temporary folder, because the prune
// step makes its output differ from the patched file in build/. The output/ folder may be stale.
function buildShortNote() {
  fs.rmSync(TMP, { recursive: true, force: true });
  const dirs = Object.fromEntries(['templates', 'diffs', 'output', 'development'].map((d) => [d, path.join(TMP, d)]));
  Object.values(dirs).forEach((d) => fs.mkdirSync(d, { recursive: true }));
  fs.copyFileSync(path.join(REPO, 'templates', `${BASE}-template.csl`), path.join(dirs.templates, `${BASE}-template.csl`));
  fs.copyFileSync(path.join(REPO, 'diffs', `${BASE}.diff`), path.join(dirs.diffs, `${BASE}.diff`));
  const result = spawnSync(
    'python',
    ['-c', 'from style_variant_builder.build import main; raise SystemExit(main())',
      '-T', dirs.templates, '-D', dirs.diffs, '-O', dirs.output, '-E', dirs.development, '--flat-output'],
    { encoding: 'utf8', env: { ...process.env, PYTHONPATH: path.join(REPO, 'src'), PYTHONIOENCODING: 'utf-8' } },
  );
  const built = path.join(dirs.output, `${BASE}.csl`);
  if (result.status !== 0 || !fs.existsSync(built)) {
    throw new Error(`Build failed:\n${result.error || ''}${result.stdout}${result.stderr}`);
  }
  const style = fs.readFileSync(built, 'utf8');
  fs.rmSync(TMP, { recursive: true, force: true });
  return style;
}

function makeTestCopy(style) {
  let copy = style;
  for (const [from, to] of EDITS) {
    if (copy.split(from).length !== 2) throw new Error(`Expected exactly one match for: ${from}`);
    copy = copy.replace(from, () => to);
  }
  const before = style.split('\n');
  const after = copy.split('\n');
  const changed = after.filter((line, n) => line !== before[n]).length;
  if (before.length !== after.length || changed !== EDITS.length) {
    throw new Error(`Expected ${EDITS.length} changed lines, found ${changed}`);
  }
  return copy;
}

const file = path.join(EXPORT, `${BASE}-test.csl`);
fs.mkdirSync(EXPORT, { recursive: true });
fs.writeFileSync(file, makeTestCopy(buildShortNote()));
console.log(`Exported ${file}`);
