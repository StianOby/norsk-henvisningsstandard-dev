// Writes the [TEST] copy of the short note variant to test-style/, which is tracked, so the repo
// always holds a copy of the current style. npm test and npm run update call writeTestStyle.
// npm run export also copies it into Zotero's styles folder, where it sits next to the regular style.
// The copy is the real builder's output, with only the three lines in EDITS changed.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const TEST_STYLE = path.join(__dirname, 'test-style');
const TMP = path.join(__dirname, 'build', 'export-tmp');
const BASE = 'norsk-henvisningsstandard-for-rettsvitenskapelige-tekster';
const ID = `http://www.zotero.org/styles/${BASE}`;
const TEST_ID = `${ID}-test`;
// ZOTERO_STYLES overrides the folder, for trying this out on a copy.
const STYLES = process.env.ZOTERO_STYLES || path.join(os.homedir(), 'Zotero', 'styles');

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

function field(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
  return match && match[1];
}

// Maps every file in the folder and its subfolders, such as hidden/, to a hash of its content.
function hashes(dir) {
  const files = fs.readdirSync(dir, { recursive: true })
    .map((f) => path.join(dir, f))
    .filter((f) => fs.statSync(f).isFile());
  return Object.fromEntries(
    files.map((f) => [f, crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]),
  );
}

// Writes only the test copy's own file. It refuses if that file holds another style, or if
// another file has the test copy's ID or title, and then proves that nothing else changed.
function copyToZotero(copy) {
  if (!fs.existsSync(STYLES)) throw new Error(`Zotero styles folder not found: ${STYLES}`);
  const target = path.join(STYLES, `${BASE}-test.csl`);
  const before = hashes(STYLES);
  for (const file of Object.keys(before).filter((f) => f.toLowerCase().endsWith('.csl'))) {
    const xml = fs.readFileSync(file, 'utf8');
    const sameId = field(xml, 'id') === TEST_ID;
    const sameTitle = field(xml, 'title') === field(copy, 'title');
    if (file === target && !sameId) throw new Error(`Not overwriting, ${file} is another style: ${field(xml, 'id')}`);
    if (file !== target && (sameId || sameTitle)) throw new Error(`Not copying, ${file} has the same ID or title`);
  }
  fs.writeFileSync(target, copy);
  const after = hashes(STYLES);
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((f) => f !== target && before[f] !== after[f]);
  if (changed.length) throw new Error(`Other files changed: ${changed.join(', ')}`);
  return { target, others: Object.keys(after).length - 1 };
}

function writeTestStyle() {
  const file = path.join(TEST_STYLE, `${BASE}-test.csl`);
  const copy = makeTestCopy(buildShortNote());
  fs.mkdirSync(TEST_STYLE, { recursive: true });
  fs.writeFileSync(file, copy);
  return { file, copy };
}

module.exports = { writeTestStyle };

if (require.main === module) {
  const { file, copy } = writeTestStyle();
  console.log(`Wrote ${file}`);
  const { target, others } = copyToZotero(copy);
  console.log(`Copied to ${target} (${others} other files unchanged). Restart Zotero to load it.`);
}
